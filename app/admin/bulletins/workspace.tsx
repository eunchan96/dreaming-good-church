"use client";

import { useEffect, useState } from "react";
import { confirmItem, createBulletin, createItem, editItem, type BulletinItem } from "@/lib/bulletins";
import { errorMessage, loadBulletins, makeBrowserClient, saveDraft, type SavedBulletin } from "@/lib/bulletin-store";
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
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!client) return;
    let active = true;
    async function restore() {
      try {
        const { data: { user } } = await client!.auth.getUser();
        if (!active) return;
        if (!user) { setSession("login"); return; }
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
        setSession("login"); setDraft(null); setRows([]); setDirty(false);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
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
    setDraft(structuredClone(row)); setDirty(false); setMessage(""); setPreview(false);
    const next = new Date(`${row.serviceDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    setCopyDate(next.toISOString().slice(0, 10));
  }
  function updateItem(id: string, changes: Partial<Pick<BulletinItem, "title" | "body" | "webVisible">>) {
    setDraft((current) => current && ({ ...current, items: current.items.map((item) => item.id === id ? editItem(item, changes) : item) }));
    setDirty(true); setMessage("");
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
      setRows(await loadBulletins(client)); setSession("editor");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!client || !draft) return;
    setBusy(true); setMessage("");
    try {
      const saved = await saveDraft(client, draft);
      setDraft(saved); setDirty(false);
      setRows((current) => [saved, ...current.filter((row) => row.id !== saved.id)].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)));
      setMessage("초안을 저장했습니다. 다시 열어도 이 내용이 유지됩니다.");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

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
    const { error } = await client.auth.signOut();
    if (error) setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    setBusy(false);
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>꿈꾸는좋은교회 · 관리자</span><h1>이번 주를 준비하는 시간</h1><p>지난 주의 내용을 이어 받아, 이번 주 주보를 차분히 완성하세요.</p></div>
      {session === "editor" || session === "denied" ? <button onClick={logout} disabled={busy}>로그아웃</button> : null}</header>
    <p role="status" aria-live="polite" className={styles.message}>{message}</p>
    {!client ? <section className={styles.card}>서비스 연결 설정이 필요합니다. 관리자에게 문의해 주세요.</section> : session === "loading" ? <p>로그인 상태를 확인하고 있습니다…</p> : session === "login" ?
      <form action={login} className={`${styles.card} ${styles.login}`}><h2>관리자 로그인</h2><p>등록된 편집 계정으로 로그인해 주세요.</p><label>이메일<input name="email" type="email" autoComplete="username" required /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label><button className={styles.primary} disabled={busy}>{busy ? "확인 중…" : "로그인"}</button></form>
      : session === "denied" ? <section className={styles.card}><h2>편집 권한이 필요합니다</h2><p>로그인한 계정이 교회 편집자로 등록되지 않았습니다. 관리자에게 등록을 요청해 주세요.</p></section>
      : <div className={styles.grid}><aside className={styles.card}><h2>주보 보관함</h2><button className={styles.primary} disabled={busy} onClick={() => {
        if (!mayLeave()) return;
        const issueNumber = rows.length ? Math.max(...rows.map((row) => row.issueNumber)) + 1 : 1;
        setDraft({ ...createBulletin({ id: crypto.randomUUID(), serviceDate: nextSunday(), issueNumber }), revision: 0,
          items: initialFields.map((title, index) => createItem({ id: crypto.randomUUID(), title, reviewOnCopy: index < 4 })) });
        setDirty(true); setMessage(""); setPreview(false);
      }}>+ 새 주보 작성</button>
      <p className={styles.muted}>최근 100개 · 저장한 초안</p>
      {rows.length ? <ul className={styles.list}>{rows.map((row) => <li key={row.id}><button className={draft?.id === row.id ? styles.selected : ""} disabled={busy} onClick={() => open(row)}><strong>{row.serviceDate}</strong><span>{row.issueNumber}호 · {row.status === "draft" ? "초안" : "게시됨"}</span></button></li>)}</ul> : <p>아직 저장한 주보가 없습니다.</p>}</aside>
      <section>{draft ? <>
        <div className={`${styles.card} ${styles.toolbar}`}><div><span className={styles.eyebrow}>주보 편집 · {dirty ? "저장 전 변경 있음" : "저장됨"}</span><h2>{draft.issueNumber}호 주보</h2><p>{draft.items.filter((item) => item.needsReview).length}개 항목 확인 필요</p></div><div className={styles.actions}><button disabled={busy} onClick={() => setPreview(!preview)}>{preview ? "편집으로 돌아가기" : "웹 미리보기"}</button><button className={styles.primary} disabled={busy || draft.status !== "draft"} onClick={save}>{busy ? "처리 중…" : "초안 저장"}</button></div></div>
        {preview ? <section className={styles.card}><h2>웹 표시 미리보기</h2><p className={styles.muted}>현재 화면의 공개 항목만 표시합니다. 아직 웹에 게시되지 않았습니다.</p>{draft.items.filter((item) => item.webVisible).map((item) => <article className={styles.preview} key={item.id}><h3>{item.title}</h3><p>{item.body || "입력된 내용이 없습니다."}</p></article>)}</section> :
        <fieldset disabled={busy || draft.status !== "draft"} className={styles.fields}>
          <div className={`${styles.card} ${styles.actions}`}><label>예배 날짜<input type="date" value={draft.serviceDate} onChange={(event) => { const value = event.target.value; setDraft((current) => current && ({ ...current, serviceDate: value })); setDirty(true); }} /></label><label>호수<input type="number" min="1" step="1" value={draft.issueNumber} onChange={(event) => { const value = Number(event.target.value); setDraft((current) => current && ({ ...current, issueNumber: value })); setDirty(true); }} /></label></div>
          {draft.items.map((item) => <article className={styles.card} key={item.id}>
            <div className={styles.itemHeader}><span className={item.needsReview ? styles.badge : styles.muted}>{item.needsReview ? "이번 주 확인 필요" : item.reviewOnCopy ? "매주 확인 항목" : "일반 항목"}</span>{item.needsReview ? <button onClick={() => { setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? confirmItem(entry) : entry) })); setDirty(true); }}>그대로 사용</button> : null}</div>
            <label htmlFor={`title-${item.id}`}>항목 제목</label><input id={`title-${item.id}`} maxLength={200} value={item.title} onChange={(event) => updateItem(item.id, { title: event.currentTarget.value })} />
            <label htmlFor={`body-${item.id}`}>내용</label><textarea id={`body-${item.id}`} rows={4} maxLength={20000} value={item.body} onChange={(event) => updateItem(item.id, { body: event.currentTarget.value })} />
            <div className={styles.itemHeader}><label className={styles.check}><input type="checkbox" checked={item.webVisible} onChange={(event) => updateItem(item.id, { webVisible: event.target.checked })} />웹에 공개</label><span className={styles.muted}>인쇄에는 포함</span></div>
            <label className={styles.check}><input type="checkbox" checked={item.reviewOnCopy} onChange={(event) => { const checked = event.target.checked; setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, reviewOnCopy: checked } : entry) })); setDirty(true); }} />다음 주 복사할 때 다시 확인</label>
          </article>)}
          <button disabled={draft.items.length >= 100} onClick={() => { const item = createItem({ id: crypto.randomUUID(), title: "새 공지" }); setDraft((current) => current && ({ ...current, items: [...current.items, item] })); setDirty(true); }}>+ 항목 추가</button>
        </fieldset>}
        <section className={styles.card}><h3>이 주보로 다음 주 준비하기</h3><p>저장된 내용과 공개 설정을 복사합니다. 매주 확인할 항목은 다시 표시됩니다.</p><div className={styles.actions}><label>새 주보 날짜<input type="date" value={copyDate} onChange={(event) => setCopyDate(event.target.value)} /></label><button onClick={copy} disabled={busy || dirty || draft.revision === 0 || !copyDate}>다음 주 주보 복사</button></div>{dirty || draft.revision === 0 ? <p className={styles.muted}>먼저 현재 주보를 저장해 주세요.</p> : null}</section>
      </> : <section className={`${styles.card} ${styles.empty}`}><span className={styles.eyebrow}>함께 준비하는 주일</span><h2>주보를 선택하거나<br />새로 작성해 주세요.</h2><p>저장한 주보는 다음 주에도 이어서 사용할 수 있습니다.</p></section>}</section></div>}
  </main>;
}
