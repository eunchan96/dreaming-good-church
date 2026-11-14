"use client";
import {bulletinSections,initialBulletinItems,printOnlyItem,sectionFor,sectionItem,type BulletinSection} from '@/lib/bulletin-editor';
import SaveButton from '../save-button';
import polish from './editor.module.css';
import {DatePicker} from '../calendar';
import PrintPreview from "./print-preview";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmItem, createBulletin, editItem, publicationIssues, type BulletinItem } from "@/lib/bulletins";
import { errorMessage, loadBulletins, makeBrowserClient, saveDraft, type SavedBulletin } from "@/lib/bulletin-store";
import { BlockFields, BlockPreview } from "./block-fields";
import CommunityLinks from "./community-links";
import { ImagePicker } from "./image-picker";
import styles from "./workspace.module.css";
import AdminShell from '../admin-shell';
import PasswordField from '../password-field';
import ManagementHeading from '../management-heading';
import SiteIcon from '@/app/site-icon';
import ui from '../management.module.css';


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
  const [query,setQuery]=useState('');
  const [view,setView]=useState<'library'|'register'|'detail'|'edit'>('library');
  const [groups,setGroups]=useState<Record<string,BulletinSection>>({});
  const [preview, setPreview] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const closePrint = useCallback(() => setPrintPreview(false), []);
  const [saving, setSaving] = useState(false);
  const [savePaused, setSavePaused] = useState(false);
  const version = useRef(0);
  const inFlight = useRef(false);
  const editorId = useRef<string | null>(null);
  function markDirty() { version.current += 1; setDirty(true); }
  useEffect(()=>{if(session!=='editor'||!['초안을 저장했습니다. 다시 열어도 이 내용이 유지됩니다.','주보를 게시했습니다.','게시를 취소했습니다. 초안을 수정할 수 있습니다.'].includes(message))return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),3500);return()=>clearTimeout(timer);},[session,message]);

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
    setGroups(Object.fromEntries(row.items.map(item=>[item.id,sectionFor(item)])));setView("detail"); setDraft(structuredClone(row)); setDirty(false); setSavePaused(false); setMessage(""); setPreview(false);
    const next = new Date(`${row.serviceDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    setCopyDate(next.toISOString().slice(0, 10));
  }
  function updateItem(id: string, changes: Partial<Pick<BulletinItem, "title" | "body" | "webVisible">>) {
    const item=draft?.items.find(item=>item.id===id);if(item)setGroups(current=>({...current,[id]:current[id]??sectionFor(item)}));
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
      if(!publish){setView("edit");setPreview(false);}
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function createNew() {
    if (!mayLeave()) return;
    const issueNumber=rows.length?Math.max(...rows.map(row=>row.issueNumber))+1:1;
    setDraft({...createBulletin({id:crypto.randomUUID(),serviceDate:nextSunday(),issueNumber}),revision:0,items:initialBulletinItems()});
    setCopyDate(new Date(Date.parse(`${nextSunday()}T00:00:00Z`)+7*86400000).toISOString().slice(0,10));setGroups({});setView('register');markDirty();setSavePaused(false);setMessage('');setPreview(false);
  }
  function library() {
    if(!mayLeave())return;
    setView('library');setDirty(false);setDraft(null);setSavePaused(false);setMessage('');
  }
  const editing=view==='register'||view==='edit';
  const visibleItems=draft?.items.filter(item=>!printOnlyItem(item))??[];
  const pages=[{id:'library',label:'주보 보관함',active:view==='library',onSelect:library,sections:[{id:'bulletin-library',label:'주보 목록'}]},
    {id:'register',label:'주보 등록',active:editing,onSelect:()=>{if(editing)return;createNew();},sections:[{id:'editor-tools',label:'저장·미리보기'},...bulletinSections.map((label,index)=>({id:`bulletin-section-${index}`,label})),{id:"publication-check",label:"게시 전 확인"},{id:"next-copy",label:"다음 주 복사"}]},
    ...(view==='detail'?[{id:'detail',label:'주보 상세',active:true,onSelect:()=>{},sections:[{id:'editor-tools',label:'주보 상세'},...visibleItems.filter(item=>item.webVisible).map(item=>({id:`edit-item-${item.id}`,label:item.title})),{id:'next-copy',label:'다음 주 복사'}]}]:[])];
  return <AdminShell active="bulletins" intro={session==='editor'||session==='denied'?<ManagementHeading id="bulletin-heading" eyebrow="WEEKLY BULLETIN" title="주보 관리"/>:undefined} authenticated={session === 'editor'} canLeave={mayLeave} onLogout={session === 'editor' || session === 'denied' ? logout : undefined} busy={busy || saving} pages={pages}><main id="admin-content" tabIndex={-1} aria-labelledby={session==='editor'?'bulletin-heading':undefined} className={`${styles.page} ${session==='editor'?`${ui.surface} ${polish.surface}`:''}`}>
    {session !== 'login' ? <p role="status" aria-live="polite" className={`${styles.message} ${ui.feedback}`}>{message}</p> : null}
    {!client ? <section className={styles.card}>서비스 연결 설정이 필요합니다. 관리자에게 문의해 주세요.</section> : session === "loading" ? <p>로그인 상태를 확인하고 있습니다…</p> : session === "login" ?
      <div className={styles.authLayout}><section className={styles.authStory}><span className={styles.eyebrow}>WELCOME TO CHURCH WORKSPACE</span><h1>함께 준비하는 예배,<br /><em>함께 나누는 소식.</em></h1><p>교회의 한 주를 차분히 준비하는 공간입니다.<br />주보와 소식, 교회 안내를 이곳에서 관리하세요.</p><div className={styles.authDecoration} aria-hidden="true"><span>+</span>FAITH · HOPE · LOVE</div></section><form action={login} className={`${styles.card} ${styles.login}`}><h2>관리자 로그인</h2><p>등록된 편집 계정으로 로그인해 주세요.</p><label>이메일<input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy || saving} /></label><PasswordField label="비밀번호" name="password" autoComplete="current-password" required disabled={busy || saving} /><p role="status" aria-live="polite" className={styles.message}>{message}</p><button className={styles.primary} disabled={busy || saving}>{busy ? "확인 중…" : "로그인"}</button><p className={styles.loginHint}>초대받은 운영자만 사용할 수 있습니다.<br />비밀번호를 잊으셨다면 계정 관리 담당자에게 재설정 링크를 요청해 주세요.</p></form></div>
      : session === "denied" ? <section className={styles.card}><h2>편집 권한이 필요합니다</h2><p>로그인한 계정이 교회 편집자로 등록되지 않았습니다. 관리자에게 등록을 요청해 주세요.</p></section>
      : <div className={`${styles.grid} ${styles.stacked}`}>{view==='library'?<aside aria-label="주보 보관함" id="bulletin-library" tabIndex={-1} className={ui.flat}><div className={ui.heading}><h2>주보 보관함</h2></div><div className={`${ui.searchTools} ${polish.search}`}><input type="search" aria-label="주보 검색" placeholder="날짜 · 호수 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button className={styles.primary} disabled={busy || saving} onClick={createNew}>+ 새 주보 작성</button></div>
      {rows.length ? <ul className={`${styles.list} ${ui.rowsList}`}>{rows.filter(row=>`${row.serviceDate} ${row.issueNumber}`.includes(query.trim())).map((row) => <li key={row.id}><button aria-pressed={draft?.id===row.id} disabled={busy || saving} onClick={() => open(row)}><strong>{row.serviceDate}</strong><span>{row.issueNumber}호 · {row.status === "draft" ? "초안" : "게시됨"}</span></button></li>)}</ul> : <p className={polish.empty}>등록된 주보가 없습니다.</p>}</aside>:null}
      {view!=='library'?<section>{draft ? <>
        {printPreview ? <PrintPreview onConfirm={id=>{setDraft(current=>current&&({...current,items:current.items.map(item=>item.id===id?confirmItem(item):item)}));markDirty();}} draft={draft} dirty={dirty} onClose={closePrint} pages={Object.fromEntries(draft.items.filter(item => item.printPage != null).map(item => [item.id, item.printPage!]))} onPagesChange={pages => { if (draft.status !== "draft") return; setDraft(current => current && ({ ...current, items: current.items.map(item => ({ ...item, printPage: pages[item.id] ?? null })) })); markDirty(); }} /> : null}
        <div id="editor-tools" tabIndex={-1} className={`${ui.flat} ${styles.toolbar} ${styles.editorToolbar} ${polish.toolbar} ${savePaused ? styles.saveWarning : ""}`}><div><div className={styles.compactTitle}><h2>{draft.issueNumber}호 주보</h2>{draft.status==='published'?<span className={polish.readOnly}>게시됨 · 읽기 전용</span>:null}</div>{savePaused?<p role="alert" className={polish.saveError}>자동 저장 중지 · 다시 시도 필요</p>:null}{draft.items.some(item=>item.needsReview)?<p className={polish.reviewCount}>{draft.items.filter((item) => item.needsReview).length}개 항목 확인 필요</p>:null}</div><div className={styles.actions}>{view==='detail'?<button disabled={busy||saving} onClick={()=>{if(draft.status==='published'){void changePublication(false);return;}setView('edit');setPreview(false);}}>수정</button>:<button disabled={busy || saving} onClick={() => setPreview(!preview)}>{preview ? "편집으로 돌아가기" : "웹 미리보기"}</button>}<button disabled={busy || saving} onClick={() => setPrintPreview(true)}>인쇄 미리보기</button>{editing?<SaveButton className={styles.primary} disabled={busy || saving || draft.status !== "draft" || (!dirty&&draft.revision>0&&!savePaused)} disabledHint={saving?'저장 중입니다.':draft.status!=='draft'?'게시된 주보는 읽기 전용입니다.':'현재 최신 상태입니다.'} onClick={() => { void save(); }}>{saving ? "저장 중…" : savePaused ? "저장 다시 시도" : "초안 저장"}</SaveButton>:null}</div></div>




        {preview ||view==='detail' ? <section className={`${styles.flatSection} ${polish.section}`}><h2>웹 표시 미리보기</h2><p className={styles.muted}>{draft.status === "published" ? "게시된 주보의 공개 항목입니다." : "현재 화면의 공개 항목만 표시합니다. 아직 웹에 게시되지 않았습니다."}</p>{visibleItems.filter((item) => item.webVisible).map((item) => <section id={`edit-item-${item.id}`} tabIndex={-1} key={item.id}><BlockPreview item={item} editor /></section>)}</section> :
        <fieldset id="bulletin-fields" tabIndex={-1} disabled={busy || draft.status !== "draft"} className={styles.fields}>
          <div className={`${ui.flat} ${ui.metaGrid} ${polish.meta}`}><div><label htmlFor="bulletin-service-date">예배 날짜</label><DatePicker id="bulletin-service-date" label="예배 날짜" value={draft.serviceDate} onChange={value => { setDraft((current) => current && ({ ...current, serviceDate: value })); markDirty(); }} /></div><label>호수<input type="number" min="1" step="1" value={draft.issueNumber} onChange={(event) => { const value = Number(event.target.value); setDraft((current) => current && ({ ...current, issueNumber: value })); markDirty(); }} /></label></div>
          {bulletinSections.map((section,sectionIndex)=><section id={`bulletin-section-${sectionIndex}`} tabIndex={-1} className={polish.group} key={section}><div className={ui.heading}><h2>{section}</h2><button disabled={draft.items.length>=100} onClick={()=>{const item=sectionItem(section);setGroups(current=>({...current,[item.id]:section}));setDraft(current=>current&&({...current,items:[...current.items,item]}));markDirty();}}>+ 추가</button></div>
          {section==="표지"?<details className={`${ui.options} ${polish.options}`}><summary>이미지 추가</summary><ImagePicker disabled={busy || saving || draft.status !== "draft" || draft.items.length >= 100} onAdd={(item) => { setDraft(current => current && ({ ...current, items: [...current.items, item] })); markDirty(); }} /></details>:null}{section==="좋은 소식"?<details className={`${ui.options} ${polish.options}`}><summary>공지·일정 연결</summary><CommunityLinks key={draft.id} draft={draft} locked={dirty || busy || saving} onBusy={setBusy} onImported={(updated) => { setDraft(updated); setDirty(false); setRows((current) => current.map((row) => row.id===updated.id?updated:row)); }} /></details>:null}
          {visibleItems.filter(item=>(groups[item.id]??sectionFor(item))===section).map((item) => <article id={`edit-item-${item.id}`} tabIndex={-1} className={`${styles.blockRow} ${ui.block} ${polish.item}`} key={item.id}>
            <div className={`${styles.actions} ${ui.itemToolbar} ${polish.itemTools}`}>
              <button aria-label={`${item.title} 삭제`} onClick={() => {
                if (!window.confirm(`“${item.title}” 항목을 삭제할까요? 웹과 인쇄 모두에서 제외되며, 초안 저장 시 반영됩니다.`)) return;
                setDraft((current) => current && ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) })); markDirty();
              }}><SiteIcon name="close"/></button>
            </div>
            <div className={`${styles.itemHeader} ${polish.itemHead}`}>{item.needsReview?<span className={styles.badge}>이번 주 확인 필요</span>:null}{item.needsReview ? <button onClick={() => { setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? confirmItem(entry) : entry) })); markDirty(); }}>그대로 사용</button> : null}</div>
            {item.title!==section?<div className={`${ui.row} ${polish.row}`}><label htmlFor={`title-${item.id}`}>제목</label><div className={ui.counted}><input id={`title-${item.id}`} aria-label="항목 제목" maxLength={200} value={item.title} onChange={(event) => updateItem(item.id, { title: event.currentTarget.value })} /><span aria-hidden="true">{item.title.length}/200</span></div></div>:null}
            <div className={`${ui.row} ${polish.row}`}><label htmlFor={`body-${item.id}`}>내용</label><textarea id={`body-${item.id}`} rows={4} maxLength={20000} value={item.body} onChange={(event) => updateItem(item.id, { body: event.currentTarget.value })} /></div>
            <BlockFields item={item} onChange={(content) => { setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, content, needsReview: JSON.stringify(entry.content) === JSON.stringify(content) ? entry.needsReview : false } : entry) })); markDirty(); }} />
            <div className={`${styles.itemHeader} ${polish.itemHead}`}><label className={styles.check}><input type="checkbox" checked={item.webVisible} onChange={(event) => updateItem(item.id, { webVisible: event.target.checked })} />웹에 공개</label></div>
            <label className={`${styles.check} ${polish.weekly}`}><input type="checkbox" checked={item.reviewOnCopy} onChange={(event) => { const checked = event.target.checked; setDraft((current) => current && ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, reviewOnCopy: checked } : entry) })); markDirty(); }} />다음 주 복사할 때 다시 확인</label>
          </article>)}</section>)}
        </fieldset>}
        <section id="publication-check" tabIndex={-1} className={`${styles.flatSection} ${polish.section}`}><div className={styles.compactTitle}><h2>{draft.status === "published" ? "게시된 주보" : "게시 전 확인"}</h2></div>
          <p>공개 {draft.items.filter((item) => item.webVisible).length}개 · 비공개 {draft.items.filter((item) => !item.webVisible).length}개. 비공개 항목은 웹에 표시되지 않습니다.</p>
          {draft.status === "draft" ? <><ul>{publicationIssues(draft).map((issue) => <li key={issue}>{issue}</li>)}</ul><button disabled={busy || saving || dirty || draft.revision === 0 || publicationIssues(draft).length > 0} onClick={() => changePublication(true)}>주보 게시</button></> : <button disabled={busy || saving} onClick={() => changePublication(false)}>게시 취소</button>}
        </section>
        <section id="next-copy" tabIndex={-1} className={`${styles.flatSection} ${polish.section}`}><h3>이 주보로 다음 주 준비하기</h3><div className={styles.actions}><div><label htmlFor="bulletin-copy-date">새 주보 날짜</label><DatePicker id="bulletin-copy-date" label="새 주보 날짜" value={copyDate} onChange={setCopyDate} /></div><button onClick={copy} disabled={busy || saving || dirty || draft.revision === 0 || !copyDate}>다음 주 주보 복사</button></div>{dirty || draft.revision === 0 ? <p className={styles.muted}>먼저 현재 주보를 저장해 주세요.</p> : null}</section>
      </> : <section className={polish.empty}><p>주보를 선택하거나 새로 작성해 주세요.</p></section>}</section>:null}</div>}
  </main></AdminShell>;
}
