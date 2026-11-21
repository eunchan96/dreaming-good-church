"use client";
import {bulletinSections,initialBulletinItems,printOnlyItem,sectionFor,presentationItems,renderedItems,type BulletinSection} from '@/lib/bulletin-editor';
import SaveButton from '../save-button';
import polish from './editor.module.css';
import {DatePicker} from '../calendar';
import BulletinForm from './editor-form';
import PrintPreview from "./print-preview";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { confirmItem, createBulletin, copyBulletin, createItem, editItem, publicationIssues, type BulletinItem } from "@/lib/bulletins";
import { errorMessage, loadBulletins, makeBrowserClient, saveDraft, type SavedBulletin } from "@/lib/bulletin-store";
import {PaperView} from "./paper";
import ThemePicker from "./theme-picker";
import {PrintEditorProvider} from "./print-editor";
import ChurchContentProvider from '@/app/church-content';
import CommunityLinks from "./community-links";
import { CoverImages } from "./image-picker";
import { useEditHistory } from "./use-edit-history";
import AdminLoading from "../admin-loading";
import styles from "./workspace.module.css";
import AdminShell from '../admin-shell';
import { forgetSignedIn } from '../admin-session';
import PasswordField from '../password-field';
import ui from '../management.module.css';
import view_ from './view.module.css';
import AdminIcon from '../admin-icons';
import ManagementHeading from '../management-heading';


const visibilityKey='church-bulletin-visibility-controls',connectionsKey='church-bulletin-connections';
function connectionsSnapshot(){try{return localStorage.getItem(connectionsKey)==='true';}catch{return false;}}
function setConnectionsOption(value:boolean){try{localStorage.setItem(connectionsKey,String(value));}catch{}dispatchEvent(new Event('bulletin-options'));}
function visibilitySnapshot(){try{return localStorage.getItem(visibilityKey)==='true';}catch{return false;}}
function subscribeOptions(listener:()=>void){addEventListener('storage',listener);addEventListener('bulletin-options',listener);return()=>{removeEventListener('storage',listener);removeEventListener('bulletin-options',listener);};}
function setVisibilityOption(value:boolean){try{localStorage.setItem(visibilityKey,String(value));}catch{}dispatchEvent(new Event('bulletin-options'));}
function nextSunday() {
  const date = new Date();
  const korea = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  korea.setDate(korea.getDate() + ((7 - korea.getDay()) % 7));
  return `${korea.getFullYear()}-${String(korea.getMonth() + 1).padStart(2, "0")}-${String(korea.getDate()).padStart(2, "0")}`;
}

export default function BulletinWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [session, setSession] = useState<"loading" | "login" | "editor" | "denied">("loading");
  // Signed out (or never signed in): drop the remembered sign-in hint so the menu and tabs hide with the login form.
  useEffect(() => { if (session === 'login') forgetSignedIn(); }, [session]);
  const [rows, setRows] = useState<SavedBulletin[]>([]);
  const [draft, setDraft] = useState<SavedBulletin | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const initialItems=useRef('');
  const [query,setQuery]=useState('');
  const [view,setView]=useState<'library'|'register'|'detail'|'edit'|'settings'>('library');
  const [visibilityDraft,setVisibilityDraft]=useState(false),[connectionsDraft,setConnectionsDraft]=useState(false);
  const showConnections=useSyncExternalStore(subscribeOptions,connectionsSnapshot,()=>false);
  const showVisibility=useSyncExternalStore(subscribeOptions,visibilitySnapshot,()=>false);
  const [groups,setGroups]=useState<Record<string,BulletinSection>>({});
  const [preview, setPreview] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const printEdited = useRef(false);
  // Edits made in print preview from the detail view continue in the editor, where saving is expected.
  const closePrint = useCallback(() => { setPrintPreview(false); if (printEdited.current && view === 'detail') { setView('edit'); setPreview(false); } printEdited.current = false; }, [view]);

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

  function mayLeave() { return !(dirty||view==='settings'&&(visibilityDraft!==showVisibility||connectionsDraft!==showConnections)) || window.confirm("저장하지 않은 변경 사항이 있습니다. 변경 내용을 버릴까요?"); }
  function open(row: SavedBulletin) {
    if (!mayLeave()) return;
    setGroups(Object.fromEntries(row.items.map(item=>[item.id,sectionFor(item)])));setView("detail"); setDraft(structuredClone(row)); setDirty(false); setSavePaused(false); setMessage(""); setPreview(false);

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

  const save = useCallback(async (returnToLibrary=false) => {
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
      if(returnToLibrary&&version.current===savedVersion){setView("library");setDraft(null);setPreview(false);}
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
    if (!dirty || busy || saving || savePaused || session !== "editor" || !draft || draft.revision === 0 || view === 'detail') return;
    const timer = window.setTimeout(() => { void save(); }, 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, busy, saving, savePaused, session, draft, save, view]);

  async function importPrevious(){
    if(!client||!draft||draft.revision!==0||busy||inFlight.current)return;
    if(JSON.stringify(draft.items)!==initialItems.current&&!window.confirm('작성 중인 내용을 지난 주 정보로 바꿀까요? 날짜와 호수는 유지됩니다.'))return;
    setBusy(true);setMessage('');
    try{const fresh=await loadBulletins(client);setRows(fresh);const source=fresh.filter(row=>row.serviceDate<draft.serviceDate).sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate))[0];
      if(!source){setMessage('가져올 지난 주 주보가 없습니다.');return;}
      const base=copyBulletin(source,{id:draft.id,serviceDate:draft.serviceDate,issueNumber:draft.issueNumber},()=>crypto.randomUUID());const copied={...base,items:base.items.map(tidyOrder),revision:0};
      setDraft(copied);setGroups(Object.fromEntries(copied.items.map(item=>[item.id,sectionFor(item)])));initialItems.current=JSON.stringify(copied.items);markDirty();setSavePaused(false);setMessage('지난 주 정보를 가져왔습니다.');
    }catch(error){setMessage(errorMessage(error));}finally{setBusy(false);}
  }

  async function logout() {
    if (!client || !mayLeave()) return;
    setBusy(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    else { setDraft(null); setRows([]); setDirty(false); editorId.current = null; setMessage(""); }
    setBusy(false);
  }

  async function changePublication(publish:boolean){
    if(!client||!draft||busy||inFlight.current)return;
    const prepared={...draft,items:draft.items.map(confirmItem)};
    if(publish&&publicationIssues(prepared).length){setMessage(publicationIssues(prepared).join(' '));return;}
    if(!window.confirm(publish?'주보를 웹에 게시할까요?':'게시를 취소하고 초안으로 돌릴까요? 공개 주보에서 제외됩니다.'))return;
    setBusy(true);setMessage('');const savedVersion=version.current;
    try{
      const {data:{user},error:authError}=await client.auth.getUser();if(authError)throw authError;if(!user||user.id!==editorId.current){setSession('login');throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');}
      let current=draft;
      if(publish&&(dirty||draft.revision===0||draft.items.some(item=>item.needsReview))){
        current=await saveDraft(client,prepared);setDraft(existing=>existing?.id===current.id?{...existing,revision:current.revision,items:version.current===savedVersion?current.items:existing.items}:existing);
        setDirty(version.current!==savedVersion);setSavePaused(false);setRows(existing=>[current,...existing.filter(row=>row.id!==current.id)].sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate)));
        if(version.current!==savedVersion){setMessage('추가 입력을 저장한 뒤 다시 게시해 주세요.');return;}
      }
      const {data,error}=await client.rpc('set_bulletin_publication',{p_id:current.id,p_revision:current.revision,p_publish:publish});if(error)throw error;
      const updated={...current,status:data.status,revision:data.revision} as SavedBulletin;setDraft(updated);setRows(existing=>existing.map(row=>row.id===updated.id?updated:row));
      setMessage(publish?'주보를 게시했습니다.':'게시를 취소했습니다. 초안을 수정할 수 있습니다.');if(publish){setView('library');setDraft(null);setPreview(false);setPrintPreview(false);}else{setView('edit');setPreview(false);}
    }catch(error){setMessage(errorMessage(error));}finally{setBusy(false);}
  }

  function previousFor(date:string){return rows.filter(row=>row.serviceDate<date).sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate))[0];}
  function importItems(ids:string[],source:BulletinItem[]){
    if(!draft||draft.status!=='draft'||!source.length)return;
    if(draft.items.length-ids.length+source.length>100){setMessage('주보 항목은 100개까지 저장할 수 있습니다.');return;}
    setDraft(current=>{if(!current)return current;const at=current.items.findIndex(item=>ids.includes(item.id));if(at<0)return current;const old=current.items.filter(item=>ids.includes(item.id));const imported=source.map((item,i)=>({...structuredClone(item),id:old[i]?.id??crypto.randomUUID(),webVisible:(old[i]?.webVisible??old.every(entry=>entry.webVisible))&&item.webVisible,needsReview:false}));const rest=current.items.filter(item=>!ids.includes(item.id));rest.splice(at,0,...imported);return {...current,items:rest};});markDirty();setMessage('지난 주 내용을 가져왔습니다.');
  }
  function changeDate(value:string){
    if(!draft)return;const previous=previousFor(value),oldPrevious=previousFor(draft.serviceDate),wasPristine=JSON.stringify(draft.items)===initialItems.current;
    const oldDefaults=initialBulletinItems(draft.serviceDate,oldPrevious),nextDefaults=initialBulletinItems(value,previous);
    if(draft.revision===0&&wasPristine){const used=new Set<string>();const items=nextDefaults.map(item=>{const old=draft.items.find(entry=>entry.title===item.title&&entry.kind===item.kind&&!used.has(entry.id));if(old)used.add(old.id);return {...item,id:old?.id??item.id};});initialItems.current=JSON.stringify(items);setDraft({...draft,serviceDate:value,items});markDirty();return;}
    const items=draft.revision===0?draft.items.map(item=>{const old=oldDefaults.find(entry=>entry.title===item.title),next=nextDefaults.find(entry=>entry.title===item.title);if(!old||!next)return item;const copyingBody=item.body===old.body,updated={...item,body:copyingBody?next.body:item.body,webVisible:copyingBody&&item.webVisible===old.webVisible?next.webVisible:item.webVisible};if(!item.content)return updated;const content={...item.content};
      if(content.rows&&old.content?.rows&&next.content?.rows)content.rows=content.rows.map((row,i)=>row.map((cell,j)=>cell===old.content!.rows?.[i]?.[j]?(next.content!.rows?.[i]?.[j]??cell):cell));
      if(content.month===old.content?.month&&next.content?.month)content.month=next.content.month;
      if(item.kind==='offering'&&content.disabled===old.content?.disabled)content.disabled=next.content?.disabled;
      return {...updated,content};
    }):draft.items;
    if(wasPristine)initialItems.current=JSON.stringify(items);setDraft({...draft,serviceDate:value,items});markDirty();
  }
  function createNew() {
    if (!mayLeave()) return;
    const issueNumber=rows.length?Math.max(...rows.map(row=>row.issueNumber))+1:1;
    const date=nextSunday(),items=initialBulletinItems(date,previousFor(date));initialItems.current=JSON.stringify(items);setDraft({...createBulletin({id:crypto.randomUUID(),serviceDate:date,issueNumber}),revision:0,items,theme:previousFor(date)?.theme});
    setGroups({});setView('register');markDirty();setSavePaused(false);setMessage('');setPreview(false);
  }
  function library() {
    if(!mayLeave())return;
    setView('library');setDirty(false);setDraft(null);setSavePaused(false);setMessage('');
  }
  const editing=view==='register'||view==='edit';
  const restore=useCallback((next:Pick<SavedBulletin,'serviceDate'|'issueNumber'|'items'>)=>{setDraft(current=>current&&current.status==='draft'?{...current,...next}:current);version.current+=1;setDirty(true);},[]);
  useEditHistory(draft,editing&&!preview&&!printPreview,restore);
  const previous=draft?previousFor(draft.serviceDate):undefined;
  const visibleItems=presentationItems(draft?.items??[]).filter(item=>!printOnlyItem(item));
  const webItems=visibleItems.filter(item=>item.webVisible);
  const locked=busy||saving;
  function openSettings(){if(view==='settings')return;setVisibilityDraft(showVisibility);setConnectionsDraft(showConnections);setView('settings');}
  const pages=[{id:'library',label:'주보 목록',active:view==='library',onSelect:library,sections:[{id:'bulletin-library',label:'주보 목록'}]},
    ...(view==='detail'?[{id:'detail',label:'주보 상세',active:true,onSelect:()=>{},sections:bulletinSections.flatMap((label,index)=>label==='예배 안내'||renderedItems(webItems).some(item=>sectionFor(item)===label)?[{id:`detail-section-${index}`,label}]:[])}]:[]),
    ...(editing||view==='settings'&&draft?.status==='draft'?[{id:'register',label:'주보 등록',active:editing,onSelect:()=>{if(editing)return;if(view==='settings'&&draft&&draft.status==='draft'){setView(draft.revision===0?'register':'edit');return;}createNew();},sections:[...bulletinSections.map((label,index)=>({id:`bulletin-section-${index}`,label})), {id:"bulletin-publish",label:"저장·게시하기"}]}]:[]),
    {id:'settings',label:'주보 설정',active:view==='settings',onSelect:openSettings,sections:[{id:'bulletin-options',label:'입력 화면 설정'}]},
  ];
  const filtered=rows.filter(row=>`${row.serviceDate} ${row.issueNumber}`.includes(query.trim()));
  const saveState=!draft?null:draft.status!=='draft'?{state:'saved',text:'게시됨 · 읽기 전용'}:saving?{state:'pending',text:'저장 중…'}:savePaused?{state:'error',text:'자동 저장 중지 · 다시 시도 필요'}:draft.revision===0?{state:'pending',text:'아직 저장하지 않은 새 주보'}:dirty?{state:'pending',text:'변경 사항 저장 대기'}:{state:'saved',text:'모든 변경 사항 저장됨'};
  const statusPill=(status:SavedBulletin['status'])=><span className={view_.pill} data-status={status}>{status==='draft'?'초안':'게시됨'}</span>;
  const reader=draft?<>
    <section className={`${polish.reader} ${view_.reader}`} aria-label="주보 상세 내용">
      {webItems.some(item=>sectionFor(item)==='표지')?null:<header className={view_.readerHead}><span>꿈꾸는좋은교회 · 주일 주보</span><h3>{draft.issueNumber}호 주보</h3><p>{longDate(draft.serviceDate)}</p></header>}
      {webItems.length?<ChurchContentProvider><PrintEditorProvider bulletinId={draft.id} editable={false} plain webFormats onReplace={()=>{}}><PaperView items={webItems} meta={draft} sectionIdPrefix="detail-section" addSchedule theme={draft.theme}/></PrintEditorProvider></ChurchContentProvider>:<p className={view_.empty}>웹에 공개할 내용이 아직 없습니다.</p>}
    </section></>:null;

  return <AdminShell active="bulletins" intro={session==='editor'||session==='denied'?<ManagementHeading id="bulletin-heading" eyebrow="WEEKLY BULLETIN" title="주보 관리"/>:undefined} authenticated={session === 'editor'} canLeave={mayLeave} onLogout={session === 'editor' || session === 'denied' ? logout : undefined} busy={locked} pages={pages}><main id="admin-content" tabIndex={-1} aria-labelledby={session==='editor'||session==='denied'?'bulletin-heading':undefined} className={`${styles.page} ${session==='editor'||session==='denied'?`${ui.surface} ${polish.surface} ${view_.view}`:''}`}>
    {!client ? <section className={styles.card}>서비스 연결 설정이 필요합니다. 관리자에게 문의해 주세요.</section> : session === "loading" ? <AdminLoading/> : session === "login" ?
      <div className={styles.authLayout}><section className={styles.authStory}><span className={styles.eyebrow}>WELCOME TO CHURCH WORKSPACE</span><h1>함께 준비하는 예배,<br /><em>함께 나누는 소식.</em></h1><p>교회의 한 주를 차분히 준비하는 공간입니다.<br />주보와 소식, 교회 안내를 이곳에서 관리하세요.</p><a className={styles.authHome} href="/" target="_blank" rel="noreferrer">교회 홈페이지 보기<span aria-hidden="true">↗</span></a></section><form action={login} className={`${styles.card} ${styles.login}`}><h2>관리자 로그인</h2><p>등록된 편집 계정으로 로그인해 주세요.</p><label>이메일<input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={locked} /></label><PasswordField label="비밀번호" name="password" autoComplete="current-password" required disabled={locked} /><p role="status" aria-live="polite" className={styles.message}>{message}</p><button className={styles.primary} disabled={locked}>{busy ? "확인 중…" : "로그인"}</button><p className={styles.loginHint}>초대받은 운영자만 사용할 수 있습니다.<br />비밀번호를 잊으셨다면 계정 관리 담당자에게 재설정 링크를 요청해 주세요.</p></form></div>
    : session === "denied" ? <><p role="status" aria-live="polite" className={view_.message}>{message}</p><section className={styles.card}><h2>편집 권한이 필요합니다</h2><p>로그인한 계정이 교회 편집자로 등록되지 않았습니다. 관리자에게 등록을 요청해 주세요.</p></section></>
    : <>
      <p role="status" aria-live="polite" className={view_.message}>{message}</p>

      {view==='library'?<section aria-labelledby="bulletin-library-title" id="bulletin-library" tabIndex={-1}>
        <div className={view_.cardHead}><h2 id="bulletin-library-title">주보 목록</h2><div className={view_.headActions}><input type="search" className={view_.search} aria-label="주보 검색" placeholder="날짜 또는 호수로 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button type="button" className={`${view_.btn} ${view_.primary}`} disabled={locked} onClick={createNew}>+ 새 주보 작성</button></div></div>
        {filtered.length?<ul className={view_.list}>{filtered.map(row=><li key={row.id}><button type="button" className={view_.row} aria-pressed={draft?.id===row.id} aria-label={`${longDate(row.serviceDate)} (${row.serviceDate}) · ${row.issueNumber}호 · ${row.status==='draft'?'초안':'게시됨'}`} disabled={locked} onClick={()=>open(row)}><span>{longDate(row.serviceDate)}</span><small>{row.issueNumber}호</small>{statusPill(row.status)}<span className={view_.chev} aria-hidden="true">›</span></button></li>)}</ul>
          :<div className={`${view_.list} ${view_.empty}`}>{rows.length?'검색 결과가 없습니다.':'등록된 주보가 없습니다. 새 주보를 작성해 보세요.'}</div>}
      </section>:null}

      {view==='settings'?<section id="bulletin-options" aria-labelledby="bulletin-options-title"><div className={view_.cardHead}><h2 id="bulletin-options-title">주보 설정</h2><div className={view_.headActions}><SaveButton className={`${view_.btn} ${view_.primary}`} disabled={visibilityDraft===showVisibility&&connectionsDraft===showConnections} disabledHint="현재 최신 상태입니다." onClick={()=>{setVisibilityOption(visibilityDraft);setConnectionsOption(connectionsDraft);setMessage("주보 설정을 저장했습니다.");}}>저장</SaveButton></div></div><div className={view_.settings}><label className={styles.check}><input type="checkbox" checked={visibilityDraft} onChange={e=>setVisibilityDraft(e.target.checked)}/>웹 공개 설정 표시</label><label className={styles.check}><input type="checkbox" checked={connectionsDraft} onChange={e=>setConnectionsDraft(e.target.checked)}/>공지·일정 연결 표시</label></div></section>:null}

      {view!=='library'&&view!=='settings'?(draft?<>
        {printPreview ? <PrintPreview onEdit={()=>void changePublication(false)} onReplace={item=>{if(draft.status!=="draft"||busy)return;printEdited.current=true;setDraft(current=>current&&({...current,items:current.items.map(original=>original.id===item.id?item:original)}));markDirty();}} draft={draft} dirty={dirty} onClose={closePrint} pages={Object.fromEntries(draft.items.filter(item => item.printPage != null).map(item => [item.id, item.printPage!]))} onPagesChange={pages => { if (draft.status !== "draft") return; printEdited.current = true; setDraft(current => current && ({ ...current, items: current.items.map(item => ({ ...item, printPage: pages[item.id] ?? null })) })); markDirty(); }} /> : null}

        <div id="editor-tools" tabIndex={-1} className={view_.bar}>
          <button type="button" className={`${view_.btn} ${view_.ghost} ${view_.back}`} aria-label="주보 목록 돌아가기" disabled={locked} onClick={library}><AdminIcon name="back" size={16}/>주보 목록</button>
          <div className={view_.titleRow}>
            <div><div className={view_.titleLine}><h2>{draft.issueNumber}호 주보</h2>{editing&&draft.status==='draft'?<span className={view_.pill} data-status="draft">{draft.revision===0?'새 주보':'편집 중'}</span>:statusPill(draft.status)}</div><p>{longDate(draft.serviceDate)}</p></div>
            <div className={view_.actions}>
              <button type="button" className={view_.btn} disabled={locked} onClick={() => setPrintPreview(true)}>인쇄 미리보기</button>
              {view==='detail'?<>
                <button type="button" className={view_.btn} disabled={locked} title={draft.status==='published'?'게시를 취소하고 초안으로 돌린 뒤 수정합니다.':undefined} onClick={()=>{if(draft.status==='published'){void changePublication(false);return;}setView('edit');setPreview(false);}}>수정</button>
                {draft.status==='draft'?<SaveButton className={`${view_.btn} ${view_.primary}`} disabled={locked} disabledHint="처리 중입니다." onClick={()=>void changePublication(true)}>게시하기</SaveButton>:<button type="button" className={`${view_.btn} ${view_.ghost}`} disabled={locked} onClick={()=>void changePublication(false)}>게시 취소</button>}
              </>:null}
            </div>
          </div>
          {editing?<div className={view_.toolRow}>
            <div className={view_.segmented} role="group" aria-label="보기 전환"><button type="button" className={view_.seg} aria-pressed={!preview} disabled={locked} onClick={()=>setPreview(false)}>편집</button><button type="button" className={view_.seg} aria-pressed={preview} disabled={locked} onClick={()=>setPreview(true)}>웹 미리보기</button></div>
            {!preview?<div className={`${view_.meta} ${view_.meta}`}><div><label htmlFor="bulletin-service-date">예배 날짜</label><DatePicker id="bulletin-service-date" label="예배 날짜" disabled={busy||draft.status!=='draft'} value={draft.serviceDate} onChange={changeDate}/></div><label>호수<input className={view_.issue} type="number" min="1" step="1" disabled={busy||draft.status!=='draft'} value={draft.issueNumber} onChange={e=>{setDraft(current=>current&&({...current,issueNumber:Number(e.target.value)}));markDirty();}}/></label>{draft.revision===0?<SaveButton className={`${view_.btn} ${view_.ghost}`} disabled={locked||!rows.some(row=>row.serviceDate<draft.serviceDate)} disabledHint={locked?'처리 중입니다.':'가져올 지난 주 주보가 없습니다.'} onClick={()=>void importPrevious()}>지난 주 정보 가져오기</SaveButton>:null}</div>:null}
            {!preview?<div className={view_.themeRow}><span className={view_.themeLabel}>주보 테마</span><ThemePicker value={draft.theme} disabled={busy||draft.status!=='draft'} onChange={key=>{setDraft(current=>current&&({...current,theme:key}));markDirty();}}/></div>:null}
          </div>:null}
        </div>

        {preview||view==='detail'?reader:
        <fieldset id="bulletin-fields" tabIndex={-1} disabled={busy || draft.status !== "draft"} className={styles.fields}>
          <BulletinForm previous={previous} onImport={importItems} onRemove={ids=>{setDraft(current=>current&&({...current,items:current.items.filter(item=>!ids.includes(item.id))}));markDirty();}} onOrderNews={ids=>{setDraft(current=>{if(!current)return current;const lookup=new Map(current.items.map(item=>[item.id,item]));let at=0;return {...current,items:current.items.map(item=>ids.includes(item.id)?lookup.get(ids[at++])!:item)};});markDirty();}} onAddNews={()=>{setDraft(current=>current&&current.items.length<100?{...current,items:[...current.items,{...createItem({id:crypto.randomUUID(),title:'좋은 소식 · 새 소식 '+(current.items.filter(item=>/새 소식/.test(item.title)).length+1)}),printPage:4}]}:current);markDirty();}} items={visibleItems} groups={groups} showVisibility={showVisibility} onText={updateItem} onContent={(id,content,body)=>{setDraft(current=>current&&({...current,items:current.items.map(item=>item.id===id?{...item,content,...(body!==undefined?{body}:{}),needsReview:JSON.stringify(item.content)===JSON.stringify(content)?item.needsReview:false}:item)}));markDirty();}}
            coverImages={images=><CoverImages items={images} disabled={locked||draft.status!=='draft'} onAdd={added=>{setDraft(current=>current&&({...current,items:[...current.items,...added].slice(0,Math.max(current.items.length,100))}));markDirty();}} onRemove={id=>{setDraft(current=>current&&({...current,items:current.items.filter(item=>item.id!==id||item.kind!=="image")}));markDirty();}}/>}
            newsConnections={showConnections?<details className={`${ui.options} ${polish.options}`}><summary>공지·일정 연결</summary><CommunityLinks key={draft.id} draft={draft} locked={dirty||locked} onBusy={setBusy} onImported={updated=>{setDraft(updated);setDirty(false);setRows(current=>current.map(row=>row.id===updated.id?updated:row));}}/></details>:null}/>
        </fieldset>}

        {editing?<div id="bulletin-publish" tabIndex={-1} className={view_.footerBar}>
          {saveState?<span className={view_.saveState} data-state={saveState.state} role={savePaused?'alert':undefined}>{saveState.text}</span>:<span/>}
          <div className={view_.actions}>
            {draft.status!=='draft'?<button type="button" className={view_.btn} disabled={locked} onClick={()=>void changePublication(false)}>게시 취소</button>:<><SaveButton className={view_.btn} disabled={locked} disabledHint={saving?'저장 중입니다.':'현재 최신 상태입니다.'} title={!dirty&&draft.revision>0?"현재 최신 상태입니다.":undefined} onClick={() => { void save(true); }}>{saving ? "저장 중…" : savePaused ? "저장 다시 시도" : "초안 저장"}</SaveButton>
            <SaveButton className={`${view_.btn} ${view_.primary}`} disabled={locked} disabledHint="처리 중입니다." onClick={()=>void changePublication(true)}>게시하기</SaveButton></>}
          </div>
        </div>:null}
      </>:<section className={view_.empty}><p>주보를 선택하거나 새로 작성해 주세요.</p></section>):null}
    </>}
  </main></AdminShell>;
}

/** The offering line is a fixed phrase without a trailing period. */
function tidyOrder(item:BulletinItem):BulletinItem{
  if(item.kind!=='worship'||!item.content?.rows)return item;
  return {...item,content:{...item.content,rows:item.content.rows.map(row=>/헌금함에 하시면 됩니다\.$/.test(row[1]??'')?[row[0],row[1].replace(/\.$/,''),...row.slice(2)]:row)}};
}

const weekdays=['일','월','화','수','목','금','토'];
function longDate(value:string){
  const [year,month,day]=value.split('-').map(Number);
  if(!year||!month||!day)return value;
  const weekday=new Date(Date.UTC(year,month-1,day)).getUTCDay();
  return `${year}년 ${month}월 ${day}일 ${weekday===0?'주일':weekdays[weekday]+'요일'}`;
}
