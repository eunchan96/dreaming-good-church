"use client";
import PrintPreview from "./print-preview";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { confirmItem, createBulletin, createItem, editItem, blockNames, publicationIssues, type BlockKind, type BulletinItem } from "@/lib/bulletins";
import { errorMessage, loadBulletins, makeBrowserClient, saveDraft, type SavedBulletin } from "@/lib/bulletin-store";
import { BlockFields, BlockPreview } from "./block-fields";
import CommunityLinks from "./community-links";
import { ImagePicker } from "./image-picker";
import styles from "./workspace.module.css";

const initialFields = ["설교 제목", "성경 본문", "찬송", "기도 담당", "교회 소식"];
function nextSunday() {
  const date = new Date();
  const korea = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  korea.setDate(korea.getDate() + ((7 - korea.getDay()) % 7));
  return `${korea.getFullYear()}-${String(korea.getMonth() + 1).padStart(2, "0")}-${String(korea.getDate()).padStart(2, "0")}`;
}

export default function BulletinWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [session, setSession] = useState<"loading" | "login" | "editor" | "denied">("loading");
  const [rows, setRows] = useState<SavedBulletin[]>([]);
  const [draft, setDraft] = useState<SavedBulletin | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyDate, setCopyDate] = useState("");
  const [newKind, setNewKind] = useState<Exclude<BlockKind, "image">>("text");
  const [preview, setPreview] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const closePrint = useCallback(() => setPrintPreview(false), []);
  const [saving, setSaving] = useState(false);
  const [savePaused, setSavePaused] = useState(false);
  const version = useRef(0);
  const inFlight = useRef(false);
  const editorId = useRef<string | null>(null);
  function markDirty() { version.current += 1; setDirty(true); }

  useEffect(() => {
    if (!client) return;
    let active = true;
    async function restore() {
      try {
        const { data: { user } } = await client!.auth.getUser();
        if (!active) return;
        if (!user) { setSession("login"); return; }
        editorId.current = user.id;
        const { data, error } = await client!.from("church_editors").select("user_id").eq("user_id", user.id).maybeSingle();
        if (!active) return;
        if (error) throw error;
        if (!data) { setSession("denied"); return; }
        const bulletins = await loadBulletins(client!);
        if (active) { setRows(bulletins); setSession("editor"); }
      } catch (error) {
        if (active) { setMessage(errorMessage(error)); setSession("login"); }
      }
    }
    void restore();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) {
        setSession("login"); setRows([]); setSavePaused(true);
        setMessage("로그인이 만료되었습니다. 같은 계정으로 다시 로그인하면 현재 탭의 작성 내용을 이어갈 수 있습니다.");
      }
    });
    async function checkSession() {
      if (document.visibilityState !== "visible") return;
      const { data, error } = await client!.auth.getUser();
      if (!active) return;
      if (!data.user && (!error || error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError")) {
        setSession("login"); setRows([]); setSavePaused(true);
        setMessage("로그인이 만료되었습니다. 작성 내용은 현재 탭에 보관 중입니다. 같은 계정으로 다시 로그인해 주세요.");
      }
    }
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", checkSession);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener("focus", checkSession); document.removeEventListener("visibilitychange", checkSession); };
  }, [client]);

  useEffect(() => {
    if (!dirty) return;
    function guard(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function mayLeave() { return !dirty || window.confirm("저장하지 않은 변경 사항이 있습니다. 변경 내용을 버릴까요?"); }
  function open(row: SavedBulletin) {
    if (!mayLeave()) return;
    setDraft(structuredClone(row)); setDirty(false); setSavePaused(false); setMessage(""); setPreview(false);
    const next = new Date(`${row.serviceDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    setCopyDate(next.toISOString().slice(0, 10));
  }
  function updateItem(id: string, changes: Partial<Pick<BulletinItem, "title" | "body" | "webVisible">>) {
    setDraft((current) => current && ({ ...current, items: current.items.map((item) => item.id === id ? editItem(item, changes) : item) }));
    markDirty(); setMessage("");
  }

  async function login(form: FormData) {
    if (!client) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
      if (error || !data.user) { setMessage("이메일 또는 비밀번호를 확인해 주세요."); return; }
      const membership = await client.from("church_editors").select("user_id").eq("user_id", data.user.id).maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) { setSession("denied"); return; }
      if (editorId.current !== data.user.id) { setDraft(null); setDirty(false); }
      editorId.current = data.user.id;
      setRows(await loadBulletins(client)); setSavePaused(false); setSession("editor");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  const save = useCallback(async () => {
    if (!client || !draft || session !== "editor" || inFlight.current) return;
    inFlight.current = true;
    const savedVersion = version.current;
    setSaving(true); setMessage("");
    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (!user || user.id !== editorId.current) { setSession("login"); throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요."); }
      const saved = await saveDraft(client, draft);
      setDraft((current) => current?.id === saved.id ? { ...current, revision: saved.revision } : current);
      setDirty(version.current !== savedVersion); setSavePaused(false);
      setRows((current) => [saved, ...current.filter((row) => row.id !== saved.id)].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)));
      setMessage("초안을 저장했습니다. 다시 열어도 이 내용이 유지됩니다.");
    } catch (error) {
      setSavePaused(true); setMessage(`${errorMessage(error)} 작성 내용은 유지됩니다. 문제를 해결한 후 ‘저장 다시 시도’를 눌러 주세요.`);
      const code = (error as { code?: string; status?: number }).code;
      const status = (error as { status?: number }).status;
      if (status === 401 || code === "PGRST301" || code === "refresh_token_not_found" || code === "session_not_found") setSession("login");
      if (code === "42501") setSession("denied");
    }
    finally { inFlight.current = false; setSaving(false); }
  }, [client, draft, session]);

  useEffect(() => {
    if (!dirty || busy || saving || savePaused || session !== "editor" || !draft || draft.revision === 0) return;
    const timer = window.setTimeout(() => { void save(); }, 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, busy, saving, savePaused, session, draft, save]);

  async function copy() {
    if (!client || !draft) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await client.rpc("copy_bulletin_draft", { p_source: draft.id, p_service_date: copyDate, p_issue_number: draft.issueNumber + 1 });
      if (error) throw error;
      const fresh = await loadBulletins(client); setRows(fresh);
      const copied = fresh.find((row) => row.id === data.id);
      if (copied) { open(copied); setMessage("내용과 공개 설정을 복사했습니다. 이번 주 내용을 확인해 주세요."); }
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!client || !mayLeave()) return;
    setBusy(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    else { setDraft(null); setRows([]); setDirty(false); editorId.current = null; setMessage(""); }
    setBusy(false);
  }

  async function changePublication(publish: boolean) {
    if (!client || !draft || dirty || inFlight.current || busy) return;
    if (publish && publicationIssues(draft).length) { setMessage(publicationIssues(draft).join(" ")); return; }
    if (!window.confirm(publish ? "공개로 설정한 항목을 웹에 게시할까요?" : "게시를 취소하고 초안으로 돌릴까요? 공개 주보에서 제외됩니다.")) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await client.rpc("set_bulletin_publication", { p_id: draft.id, p_revision: draft.revision, p_publish: publish });
      if (error) throw error;
      const updated = { ...draft, status: data.status, revision: data.revision } as SavedBulletin;
      setDraft(updated); setRows((current) => current.map((row) => row.id === updated.id ? updated : row));
      setMessage(publish ? "주보를 게시했습니다." : "게시를 취소했습니다. 초안을 수정할 수 있습니다.");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <nav><Link href="/admin/community" onClick={(event)=>{if(!mayLeave())event.preventDefault();}}>공지·일정 관리</Link> · <Link href="/admin/church" onClick={(event)=>{if(!mayLeave())event.preventDefault();}}>교회 정보·이미지 관리</Link></nav>
    <header className={styles.header}><div><span className={styles.eyebrow}>꿈꾸는좋은교회 · 관리자</span><h1>이번 주를 준비하는 시간</h1><p>지난 주의 내용을 이어 받아, 이번 주 주보를 차분히 완성하세요.</p></div>
      {session === "editor" || session === "denied" ? <button onClick={logout} disabled={busy || saving}>로그아웃</button> : null}</header>
    <p role="status" aria-live="polite" className={styles.message}>{message}</p>
    {!client ? <section className={styles.card}>서비스 연결 설정이 필요합니다. 관리자에게 문의해 주세요.</section> : session === "loading" ? <p>로그인 상태를 확인하고 있습니다…</p> : session === "login" ?
      <form action={login} className={`${styles.card} ${styles.login}`}><h2>관리자 로그인</h2><p>등록된 편집 계정으로 로그인해 주세요.</p><label>이메일<input name="email" type="email" autoComplete="username" required /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label><button className={styles.primary} disabled={busy || saving}>{busy ? "확인 중…" : "로그인"}</button></form>
      : session === "denied" ? <section className={styles.card}><h2>편집 권한이 필요합니다</h2><p>로그인한 계정이 교회 편집자로 등록되지 않았습니다. 관리자에게 등록을 요청해 주세요.</p></section>
      : <div className={styles.grid}><aside className={styles.card}><h2>주보 보관함</h2><button className={styles.primary} disabled={busy || saving} onClick={() => {
        if (!mayLeave()) return;
        const issueNumber = rows.length ? Math.max(...rows.map((row) => row.issueNumber)) + 1 : 1;
        setDraft({ ...createBulletin({ id: crypto.randomUUID(), serviceDate: nextSunday(), issueNumber }), revision: 0,
          items: initialFields.map((title, index) => createItem({ id: crypto.randomUUID(), title, reviewOnCopy: index < 4 })) });
        markDirty(); setSavePaused(false); setMessage(""); setPreview(false);
      }}>+ 새 주보 작성</button>
      <p className={styles.muted}>최근 100개 · 주보</p>
      {rows.length ? <ul className={styles.list}>{rows.map((row) => <li key={row.id}><button className={draft?.id === row.id ? styles.selected : ""} disabled={busy || saving} onClick={() => open(row)}><strong>{row.serviceDate}</strong><span>{row.issueNumber}호 · {row.status === "draft" ? "초안" : "게시됨"}</span></button></li>)}</ul> : <p>아직 저장한 주보가 없습니다.</p>}</aside>
      <section>{draft ? <>
        {printPreview ? <PrintPreview draft={draft} dirty={dirty} onClose={closePrint} /> : null}
        <div id="editor-tools" className={`${styles.card} ${styles.toolbar} ${styles.editorToolbar} ${savePaused ? styles.saveWarning : ""}`}><div><span className={styles.eyebrow}>주보 편집 · {draft.status === "published" ? "게시됨 · 읽기 전용" : saving ? "저장 중" : savePaused ? "저장 실패 · 입력 유지" : dirty ? "저장 전 변경 있음" : "저장됨"}</span><h2>{draft.issueNumber}호 주보</h2><p>{draft.status === "published" ? "수정하려면 게시를 취소해 주세요." : saving ? "저장 중…" : savePaused ? "자동 저장 중지 · 다시 시도 필요" : draft.revision === 0 ? "처음에는 초안 저장을 눌러 주세요. 이후 변경은 자동 저장됩니다." : "입력을 멈추면 자동 저장됩니다."}</p><p>{draft.items.filter((item) => item.needsReview).length}개 항목 확인 필요</p></div><div className={styles.actions}><button disabled={busy || saving} onClick={() => setPreview(!preview)}>{preview ? "편집으로 돌아가기" : "웹 미리보기"}</button><button disabled={busy || saving} onClick={() => setPrintPreview(true)}>인쇄 미리보기</button><button className={styles.primary} disabled={busy || saving || draft.status !== "draft"} onClick={() => { void save(); }}>{saving ? "저장 중…" : savePaused ? "저장 다시 시도" : "초안 저장"}</button></div></div>
        <nav className={styles.editorLinks} aria-label="편집 구역"><a href="#bulletin-fields">주보 내용으로 이동</a><a href="#publication-check">게시 전 확인으로 이동</a></nav>
        <ImagePicker disabled={busy || saving || draft.status !== "draft" || draft.items.length >= 100} onAdd={(item) => { setDraft(current => current && ({ ...current, items: [...current.items, item] })); markDirty(); }} />
        <CommunityLinks key={draft.id} draft={draft} locked={dirty || busy || saving} onBusy={setBusy} onImported={(updated) => { setDraft(updated); setDirty(false); setRows((current) => current.map((row) => row.id===updated.id?updated:row)); }} />
        <section id="publication-check" tabIndex={-1} className={styles.card}><h2>{draft.status === "published" ? "게시된 주보" : "게시 전 확인"}</h2>
          <p>공개 {draft.items.filter((item) => item.webVisible).length}개 · 비공개 {draft.items.filter((item) => !item.webVisible).length}개. 비공개 항목은 웹에 표시되지 않습니다.</p>
          {draft.status === "draft" ? <><ul>{publicationIssues(draft).map((issue) => <li key={issue}>{issue}</li>)}</ul><p>게시 후 수정하려면 게시를 취소해 주세요.</p><button disabled={busy || saving || dirty || draft.revision === 0 || publicationIssues(draft).length > 0} onClick={() => changePublication(true)}>주보 게시</button></> : <button disabled={busy || saving} onClick={() => changePublication(false)}>게시 취소</button>}
          <p><a href="/bulletins" target="_blank" rel="noreferrer">공개 주보 보기</a></p>
        </section>

        {preview ? <section className={styles.card}><h2>웹 표시 미리보기</h2><p className={styles.muted}>{draft.status === "published" ? "게시된 주보의 공개 항목입니다." : "현재 화면의 공개 항목만 표시합니다. 아직 웹에 게시되지 않았습니다."}</p>{draft.items.filter((item) => item.webVisible).map((item) => <BlockPreview key={item.id} item={item} editor />)}</section> :
        <fieldset id="bulletin-fields" tabIndex={-1} disabled={busy || draft.status !== "draft"} className={styles.fields}>
          <div className={`${styles.card} ${styles.actions}`}><label>예배 날짜<input type="date" value={draft.serviceDate} onChange={(event) => { const value = event.target.value; setDraft((current) => current && ({ ...current, serviceDate: value })); markDirty(); }} /></label><label>호수<input type="number" min="1" step="1" value={draft.issueNumber} onChange={(event) => { const value = Number(event.target.value); setDraft((current) => current && ({ ...current, issueNumber: value })); markDirty(); }} /></label></div>
          {draft.items.map((item, index) => <article className={styles.card} key={item.id}>
            <div className={styles.actions}>
              <button aria-label={`${item.title} 위로 이동`} disabled={index === 0} onClick={() => {
                setDraft((current) => { if (!current) return current; const items = [...current.items]; const at = items.findIndex((entry) => entry.id === item.id); if (at > 0) [items[at - 1], items[at]] = [items[at], items[at - 1]]; return { ...current, items }; }); markDirty();
              }}>위로</button>
              <button aria-label={`${item.title} 아래로 이동`} disabled={index === draft.items.length - 1} onClick={() => {
                setDraft((current) => { if (!current) return current; const items = [...current.items]; const at = items.findIndex((entry) => entry.id === item.id); if (at >= 0 && at < items.length - 1) [items[at], items[at + 1]] = [items[at + 1], items[at]]; return { ...current, items }; }); markDirty();
              }}>아래로</button>
              <button aria-label={`${item.title} 삭제`} onClick={() => {
                if (!window.confirm(`“${item.title}” 항목을 삭제할까요? 웹과 인쇄 모두에서 제외되며, 초안 저장 시 반영됩니다.`)) return;
                setDraft((current) => current && ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) })); markDirty();
              }}>항목 삭제</button>
            </div>
            <div className={styles.itemHeader}><span className={item.needsReview ? styles.badge : styles.muted}>{item.needsReview ? "이번 주 확인 필요" : item.reviewOnCopy ? "매주 확인 항목" : "일반 항목"}</span>{item.needsReview ? <button onClick={() => { setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? confirmItem(entry) : entry) })); markDirty(); }}>그대로 사용</button> : null}</div>
            <label htmlFor={`title-${item.id}`}>항목 제목</label><input id={`title-${item.id}`} maxLength={200} value={item.title} onChange={(event) => updateItem(item.id, { title: event.currentTarget.value })} />
            <BlockFields item={item} onChange={(content) => { setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, content, needsReview: JSON.stringify(entry.content) === JSON.stringify(content) ? entry.needsReview : false } : entry) })); markDirty(); }} />
            <label htmlFor={`body-${item.id}`}>내용</label><textarea id={`body-${item.id}`} rows={4} maxLength={20000} value={item.body} onChange={(event) => updateItem(item.id, { body: event.currentTarget.value })} />
            <div className={styles.itemHeader}><label className={styles.check}><input type="checkbox" checked={item.webVisible} onChange={(event) => updateItem(item.id, { webVisible: event.target.checked })} />웹에 공개</label><span className={styles.muted}>인쇄에는 포함</span></div>
            <label className={styles.check}><input type="checkbox" checked={item.reviewOnCopy} onChange={(event) => { const checked = event.target.checked; setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, reviewOnCopy: checked } : entry) })); markDirty(); }} />다음 주 복사할 때 다시 확인</label>
          </article>)}
          <label>추가할 항목 종류<select value={newKind} onChange={(event) => setNewKind(event.target.value as Exclude<BlockKind, "image">)}>{Object.entries(blockNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button disabled={draft.items.length >= 100} onClick={() => { const item = createItem({ id: crypto.randomUUID(), title: newKind === "text" ? "새 공지" : blockNames[newKind], kind: newKind, reviewOnCopy: newKind !== "text" }); setDraft((current) => current && ({ ...current, items: [...current.items, item] })); markDirty(); }}>+ 항목 추가</button>
        </fieldset>}
        <section className={styles.card}><h3>이 주보로 다음 주 준비하기</h3><p>저장된 내용과 공개 설정을 복사합니다. 매주 확인할 항목은 다시 표시됩니다.</p><div className={styles.actions}><label>새 주보 날짜<input type="date" value={copyDate} onChange={(event) => setCopyDate(event.target.value)} /></label><button onClick={copy} disabled={busy || saving || dirty || draft.revision === 0 || !copyDate}>다음 주 주보 복사</button></div>{dirty || draft.revision === 0 ? <p className={styles.muted}>먼저 현재 주보를 저장해 주세요.</p> : null}</section>
      </> : <section className={`${styles.card} ${styles.empty}`}><span className={styles.eyebrow}>함께 준비하는 주일</span><h2>주보를 선택하거나<br />새로 작성해 주세요.</h2><p>저장한 주보는 다음 주에도 이어서 사용할 수 있습니다.</p></section>}</section></div>}
  </main>;
}
