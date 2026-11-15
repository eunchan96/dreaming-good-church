"use client";
import {bulletinSections,initialBulletinItems,printOnlyItem,sectionFor,presentationItems,displayTitle,type BulletinSection} from '@/lib/bulletin-editor';
import SaveButton from '../save-button';
import polish from './editor.module.css';
import {DatePicker} from '../calendar';
import BulletinForm from './editor-form';
import PrintPreview from "./print-preview";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { confirmItem, createBulletin, copyBulletin, createItem, editItem, publicationIssues, type BulletinItem } from "@/lib/bulletins";
import { errorMessage, loadBulletins, makeBrowserClient, saveDraft, type SavedBulletin } from "@/lib/bulletin-store";
import BulletinBlocks from "./grouped-blocks";
import CommunityLinks from "./community-links";
import { ImagePicker } from "./image-picker";
import styles from "./workspace.module.css";
import AdminShell from '../admin-shell';
import PasswordField from '../password-field';
import ManagementHeading from '../management-heading';
import ui from '../management.module.css';


const visibilityKey='church-bulletin-visibility-controls';
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
  const [rows, setRows] = useState<SavedBulletin[]>([]);
  const [draft, setDraft] = useState<SavedBulletin | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const initialItems=useRef('');
  const [query,setQuery]=useState('');
  const [view,setView]=useState<'library'|'register'|'detail'|'edit'|'settings'>('library');
  const [settingsReturn,setSettingsReturn]=useState<'library'|'register'|'detail'|'edit'>('library');
  const showVisibility=useSyncExternalStore(subscribeOptions,visibilitySnapshot,()=>false);
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

  async function importPrevious(){
    if(!client||!draft||draft.revision!==0||busy||inFlight.current)return;
    if(JSON.stringify(draft.items)!==initialItems.current&&!window.confirm('작성 중인 내용을 지난 주 정보로 바꿀까요? 날짜와 호수는 유지됩니다.'))return;
    setBusy(true);setMessage('');
    try{const fresh=await loadBulletins(client);setRows(fresh);const source=fresh.filter(row=>row.serviceDate<draft.serviceDate).sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate))[0];
      if(!source){setMessage('가져올 지난 주 주보가 없습니다.');return;}
      const copied={...copyBulletin(source,{id:draft.id,serviceDate:draft.serviceDate,issueNumber:draft.issueNumber},()=>crypto.randomUUID()),revision:0};
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
      setMessage(publish?'주보를 게시했습니다.':'게시를 취소했습니다. 초안을 수정할 수 있습니다.');if(!publish){setView('edit');setPreview(false);}
    }catch(error){setMessage(errorMessage(error));}finally{setBusy(false);}
  }

  function createNew() {
    if (!mayLeave()) return;
    const issueNumber=rows.length?Math.max(...rows.map(row=>row.issueNumber))+1:1;
    const items=initialBulletinItems();initialItems.current=JSON.stringify(items);setDraft({...createBulletin({id:crypto.randomUUID(),serviceDate:nextSunday(),issueNumber}),revision:0,items});
    setGroups({});setView('register');markDirty();setSavePaused(false);setMessage('');setPreview(false);
  }
  function library() {
    if(!mayLeave())return;
    setView('library');setDirty(false);setDraft(null);setSavePaused(false);setMessage('');
  }
  const editing=view==='register'||view==='edit';
  const visibleItems=presentationItems(draft?.items??[]).filter(item=>!printOnlyItem(item));
  const pages=[{id:'library',label:'주보 보관함',active:view==='library',onSelect:library,sections:[{id:'bulletin-library',label:'주보 목록'}]},
    {id:'register',label:'주보 등록',active:editing,onSelect:()=>{if(editing)return;if(view==='settings'&&draft&&(settingsReturn==='register'||settingsReturn==='edit')){setView(settingsReturn);return;}createNew();},sections:[{id:'editor-tools',label:'저장·미리보기'},...bulletinSections.map((label,index)=>({id:`bulletin-section-${index}`,label})), {id:"bulletin-publish",label:"게시하기"}]},
    {id:'settings',label:'주보 설정',active:view==='settings',onSelect:()=>{if(view==='settings')return;setSettingsReturn(view);setView('settings');},sections:[{id:'bulletin-options',label:'입력 화면 설정'}]},
    ...(view==='detail'?[{id:'detail',label:'주보 상세',active:true,onSelect:()=>{},sections:[{id:'editor-tools',label:'주보 상세'},...visibleItems.filter(item=>item.webVisible).map(item=>({id:`edit-item-${item.id}`,label:displayTitle(item.title)}))]}]:[])];
  return <AdminShell active="bulletins" intro={session==='editor'||session==='denied'?<ManagementHeading id="bulletin-heading" eyebrow="WEEKLY BULLETIN" title="주보 관리"/>:undefined} authenticated={session === 'editor'} canLeave={mayLeave} onLogout={session === 'editor' || session === 'denied' ? logout : undefined} busy={busy || saving} pages={pages}><main id="admin-content" tabIndex={-1} aria-labelledby={session==='editor'?'bulletin-heading':undefined} className={`${styles.page} ${session==='editor'?`${ui.surface} ${polish.surface}`:''}`}>
    {session !== 'login' ? <p role="status" aria-live="polite" className={`${styles.message} ${ui.feedback}`}>{message}</p> : null}
    {!client ? <section className={styles.card}>서비스 연결 설정이 필요합니다. 관리자에게 문의해 주세요.</section> : session === "loading" ? <p>로그인 상태를 확인하고 있습니다…</p> : session === "login" ?
      <div className={styles.authLayout}><section className={styles.authStory}><span className={styles.eyebrow}>WELCOME TO CHURCH WORKSPACE</span><h1>함께 준비하는 예배,<br /><em>함께 나누는 소식.</em></h1><p>교회의 한 주를 차분히 준비하는 공간입니다.<br />주보와 소식, 교회 안내를 이곳에서 관리하세요.</p><div className={styles.authDecoration} aria-hidden="true"><span>+</span>FAITH · HOPE · LOVE</div></section><form action={login} className={`${styles.card} ${styles.login}`}><h2>관리자 로그인</h2><p>등록된 편집 계정으로 로그인해 주세요.</p><label>이메일<input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy || saving} /></label><PasswordField label="비밀번호" name="password" autoComplete="current-password" required disabled={busy || saving} /><p role="status" aria-live="polite" className={styles.message}>{message}</p><button className={styles.primary} disabled={busy || saving}>{busy ? "확인 중…" : "로그인"}</button><p className={styles.loginHint}>초대받은 운영자만 사용할 수 있습니다.<br />비밀번호를 잊으셨다면 계정 관리 담당자에게 재설정 링크를 요청해 주세요.</p></form></div>
      : session === "denied" ? <section className={styles.card}><h2>편집 권한이 필요합니다</h2><p>로그인한 계정이 교회 편집자로 등록되지 않았습니다. 관리자에게 등록을 요청해 주세요.</p></section>
      : <div className={`${styles.grid} ${styles.stacked}`}>{view==='library'?<aside aria-label="주보 보관함" id="bulletin-library" tabIndex={-1} className={ui.flat}><div className={ui.heading}><h2>주보 보관함</h2></div><div className={`${ui.searchTools} ${polish.search}`}><input type="search" aria-label="주보 검색" placeholder="날짜 · 호수 검색" value={query} onChange={e=>setQuery(e.target.value)}/><button className={styles.primary} disabled={busy || saving} onClick={createNew}>+ 새 주보 작성</button></div>
      {rows.length ? <ul className={`${styles.list} ${ui.rowsList}`}>{rows.filter(row=>`${row.serviceDate} ${row.issueNumber}`.includes(query.trim())).map((row) => <li key={row.id}><button aria-pressed={draft?.id===row.id} disabled={busy || saving} onClick={() => open(row)}><strong>{row.serviceDate}</strong><span>{row.issueNumber}호 · {row.status === "draft" ? "초안" : "게시됨"}</span></button></li>)}</ul> : <p className={polish.empty}>등록된 주보가 없습니다.</p>}</aside>:null}
      {view==='settings'?<section id="bulletin-options" className={polish.settings}><div className={ui.heading}><h2>주보 설정</h2><button onClick={()=>setView(settingsReturn)}>돌아가기</button></div><label className={styles.check}><input type="checkbox" checked={showVisibility} onChange={e=>setVisibilityOption(e.target.checked)}/>웹 공개 설정 표시</label></section>:null}
      {view!=='library'&&view!=='settings'?<section>{draft ? <>
        {printPreview ? <PrintPreview draft={draft} dirty={dirty} onClose={closePrint} pages={Object.fromEntries(draft.items.filter(item => item.printPage != null).map(item => [item.id, item.printPage!]))} onPagesChange={pages => { if (draft.status !== "draft") return; setDraft(current => current && ({ ...current, items: current.items.map(item => ({ ...item, printPage: pages[item.id] ?? null })) })); markDirty(); }} /> : null}
        <div id="editor-tools" tabIndex={-1} className={`${ui.flat} ${styles.toolbar} ${styles.editorToolbar} ${polish.toolbar} ${savePaused ? styles.saveWarning : ""}`}><div><div className={styles.compactTitle}><h2>{draft.issueNumber}호 주보</h2>{draft.status==='published'?<span className={polish.readOnly}>게시됨 · 읽기 전용</span>:null}</div>{editing&&!preview?<div className={polish.titleMeta}><div className={polish.compactMeta}><div><label htmlFor="bulletin-service-date">예배 날짜</label><DatePicker id="bulletin-service-date" label="예배 날짜" disabled={busy||draft.status!=='draft'} value={draft.serviceDate} onChange={value=>{setDraft(current=>current&&({...current,serviceDate:value}));markDirty();}}/></div><label>호수<input type="number" min="1" step="1" disabled={busy||draft.status!=='draft'} value={draft.issueNumber} onChange={e=>{setDraft(current=>current&&({...current,issueNumber:Number(e.target.value)}));markDirty();}}/></label></div></div>:null}{savePaused?<p role="alert" className={polish.saveError}>자동 저장 중지 · 다시 시도 필요</p>:null}</div><div className={styles.actions}>{editing&&draft.revision===0?<SaveButton className={polish.importPrevious} disabled={busy||saving||!rows.some(row=>row.serviceDate<draft.serviceDate)} disabledHint={busy||saving?'처리 중입니다.':'가져올 지난 주 주보가 없습니다.'} onClick={()=>void importPrevious()}>지난 주 정보 가져오기</SaveButton>:null}{view==='detail'?<button disabled={busy||saving} onClick={()=>{if(draft.status==='published'){void changePublication(false);return;}setView('edit');setPreview(false);}}>수정</button>:<button disabled={busy || saving} onClick={() => setPreview(!preview)}>{preview ? "편집으로 돌아가기" : "웹 미리보기"}</button>}<button disabled={busy || saving} onClick={() => setPrintPreview(true)}>인쇄 미리보기</button>{editing?<SaveButton className={styles.primary} disabled={busy || saving || draft.status !== "draft" || (!dirty&&draft.revision>0&&!savePaused)} disabledHint={saving?'저장 중입니다.':draft.status!=='draft'?'게시된 주보는 읽기 전용입니다.':'현재 최신 상태입니다.'} onClick={() => { void save(); }}>{saving ? "저장 중…" : savePaused ? "저장 다시 시도" : "초안 저장"}</SaveButton>:null}</div></div>




        {preview ||view==='detail' ? <section className={`${styles.flatSection} ${polish.section}`}><h2>웹 표시 미리보기</h2><p className={styles.muted}>{draft.status === "published" ? "게시된 주보의 공개 항목입니다." : "현재 화면의 공개 항목만 표시합니다. 아직 웹에 게시되지 않았습니다."}</p><BulletinBlocks items={visibleItems.filter(item=>item.webVisible)} editor idPrefix="edit-item"/></section> :
        <fieldset id="bulletin-fields" tabIndex={-1} disabled={busy || draft.status !== "draft"} className={styles.fields}>

          <BulletinForm onOrderNews={ids=>{setDraft(current=>{if(!current)return current;const lookup=new Map(current.items.map(item=>[item.id,item]));let at=0;return {...current,items:current.items.map(item=>ids.includes(item.id)?lookup.get(ids[at++])!:item)};});markDirty();}} onAddNews={()=>{setDraft(current=>current&&current.items.length<100?{...current,items:[...current.items,{...createItem({id:crypto.randomUUID(),title:'좋은 소식 · 새 소식'}),printPage:4}]}:current);markDirty();}} onRemoveImage={id=>{if(!window.confirm("이 주보에서 이미지 첨부를 해제할까요? 보관함의 원본 이미지는 유지됩니다."))return;setDraft(current=>current&&({...current,items:current.items.filter(item=>item.id!==id||item.kind!=="image")}));markDirty();}} items={visibleItems} groups={groups} showVisibility={showVisibility} onText={updateItem} onContent={(id,content,body)=>{setDraft(current=>current&&({...current,items:current.items.map(item=>item.id===id?{...item,content,...(body!==undefined?{body}:{}),needsReview:JSON.stringify(item.content)===JSON.stringify(content)?item.needsReview:false}:item)}));markDirty();}}
            coverPicker={<details className={`${ui.options} ${polish.options} ${polish.coverPicker}`}><summary>이미지 추가</summary><ImagePicker disabled={busy||saving||draft.status!=='draft'||draft.items.length>=100} onAdd={item=>{setDraft(current=>current&&({...current,items:[...current.items,{...item,reviewOnCopy:false}]}));markDirty();}}/></details>}
            newsConnections={<details className={`${ui.options} ${polish.options}`}><summary>공지·일정 연결</summary><CommunityLinks key={draft.id} draft={draft} locked={dirty||busy||saving} onBusy={setBusy} onImported={updated=>{setDraft(updated);setDirty(false);setRows(current=>current.map(row=>row.id===updated.id?updated:row));}}/></details>}/>
        </fieldset>}
        <div id="bulletin-publish" tabIndex={-1} className={polish.publishOnly}>{draft.status==='draft'?<SaveButton className={styles.primary} disabled={busy||saving} disabledHint="처리 중입니다." onClick={()=>void changePublication(true)}>게시하기</SaveButton>:<button disabled={busy||saving} onClick={()=>void changePublication(false)}>게시 취소</button>}</div>
      </> : <section className={polish.empty}><p>주보를 선택하거나 새로 작성해 주세요.</p></section>}</section>:null}</div>}
  </main></AdminShell>;
}
