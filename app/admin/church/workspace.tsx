"use client";
import { useEffect, useRef, useState } from "react";
import { makeBrowserClient, errorMessage } from "@/lib/bulletin-store";
import { churchLabels, type ChurchField, type BulletinImage } from "@/lib/church";
import ImageLibrary from "./image-library";
import styles from "../bulletins/workspace.module.css";
import AdminShell from '../admin-shell';
import ReauthPanel from '../reauth-panel';
import ManagementHeading from '../management-heading';
import ui from '../management.module.css';
import SectionHeading from './section-heading';
import church from './workspace.module.css';
import { saveChurchInfo } from '@/lib/church-info-store';
import { CHURCH_ADDRESS,CHURCH_PHONE,CHURCH_VISIT } from '@/lib/site-content';
import {defaultPageSettings,settingLabels,validPageSetting,type ChurchPageSettings,type SettingKey} from '@/lib/church-page-settings';
import {readPageSettings,savePageSetting} from '@/lib/church-page-store';
import PageSettingsEditor from './page-settings-editor';
const defaultInfo:Record<string,string>={name:'꿈꾸는좋은교회',address:CHURCH_ADDRESS,phone:CHURCH_PHONE,directions:CHURCH_VISIT,introduction:'꿈꾸는좋은교회에 오신 여러분을 주님의 이름으로 환영합니다.\n하나님 앞에서 더 나은 예배를 드리고, 일상에서 사랑을 나누는 공동체를 함께 꿈꿉니다.'};

const effectiveField=(field:ChurchField):ChurchField=>({...field,body:field.body.trim()?field.body:defaultInfo[field.key]||field.body});

export default function ChurchWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [allowed, setAllowed] = useState(false), [reload, setReload] = useState(0);
  const [fields, setFields] = useState<ChurchField[]>([]), [images, setImages] = useState<BulletinImage[]>([]);
  const [savedFields,setSavedFields]=useState<ChurchField[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("로그인을 확인하고 있습니다…");
  const [infoMessage,setInfoMessage]=useState('');
  const [pages,setPages]=useState<ChurchPageSettings>(structuredClone(defaultPageSettings)),[savedPages,setSavedPages]=useState<ChurchPageSettings>(structuredClone(defaultPageSettings));
  const [pageVersions,setPageVersions]=useState<Record<SettingKey,number>>({worship_times:0,offering_accounts:0,location:0}),[pageMessages,setPageMessages]=useState<Partial<Record<SettingKey,string>>>({}),[pagesReady,setPagesReady]=useState(false);
  const pageLoaded=useRef(false);
  useEffect(()=>{if(!['저장했습니다.','저장된 내용을 불러왔습니다.'].includes(infoMessage))return;const timer=setTimeout(()=>setInfoMessage(current=>current===infoMessage?'':current),3500);return()=>clearTimeout(timer);},[infoMessage]);
  useEffect(()=>{const success=Object.entries(pageMessages).filter(([,value])=>value==='저장했습니다. 공개 안내에 반영됩니다.'||value==='현재 저장된 설정을 불러왔습니다.');if(!success.length)return;const timer=setTimeout(()=>setPageMessages(current=>Object.fromEntries(Object.entries(current).filter(([key,value])=>!success.some(([oldKey,oldValue])=>key===oldKey&&value===oldValue)))),3500);return()=>clearTimeout(timer);},[pageMessages]);
  const [title, setTitle] = useState(""), [alt, setAlt] = useState(""), [file, setFile] = useState<File | null>(null);
  const owner = useRef<string | null>(null), loaded = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!allowed||!['이미지를 올렸습니다. 주보 편집 화면에서 선택해 넣을 수 있습니다.','이미지를 삭제했습니다.'].includes(message))return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),3500);return()=>clearTimeout(timer);},[allowed,message]);
  useEffect(() => {
    if (!client) return;
    let active = true;
    async function load() {
      try {
        const user = await client!.auth.getUser(); if (user.error || !user.data.user) throw new Error();
        const member = await client!.from("church_editors").select("user_id").eq("user_id", user.data.user.id).maybeSingle(); if (member.error || !member.data) throw new Error();
        const [info, assets, pageRows] = await Promise.all([client!.from("church_info").select("*").order("key"), client!.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(100),client!.from('church_page_settings').select('*')]);
        if (info.error || assets.error) throw new Error();
        if (!active) return;
        const newOwner=!loaded.current || owner.current !== user.data.user.id;
        if (newOwner) { setFields(info.data.map(effectiveField)); setSavedFields(info.data.map(effectiveField));setInfoMessage('');setTitle(""); setAlt(""); setFile(null);pageLoaded.current=false;setPages(structuredClone(defaultPageSettings));setSavedPages(structuredClone(defaultPageSettings));setPageMessages({}); }
        try{if(pageRows.error)throw pageRows.error;if(!pageLoaded.current){const current=readPageSettings(pageRows.data);setPages(current.values);setSavedPages(structuredClone(current.values));setPageVersions(current.revisions);pageLoaded.current=true;}setPagesReady(true);}catch{setPagesReady(false);}
        loaded.current = true; owner.current = user.data.user.id; setImages(assets.data); setAllowed(true); setMessage("");
      } catch { if (active) { setAllowed(false); setMessage("관리자 로그인이 필요합니다. 같은 계정으로 다시 로그인하면 현재 탭의 작성 내용을 이어갈 수 있습니다."); } }
    }
    void load();
    const { data: { subscription } } = client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") { setAllowed(false); setImages([]); setMessage("로그인이 종료되었습니다. 같은 계정으로 다시 로그인하면 작성 내용을 이어갈 수 있습니다."); } if (event === "SIGNED_IN") setReload(n => n + 1); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client, reload]);
  const changed=(field:ChurchField)=>{const saved=savedFields.find(row=>row.key===field.key);return !saved||saved.body!==field.body||saved.web_visible!==field.web_visible;};
  const infoDirty=fields.some(changed);
  const dirty=infoDirty||(Object.keys(defaultPageSettings) as SettingKey[]).some(key=>JSON.stringify(pages[key])!==JSON.stringify(savedPages[key]));
  const unsaved = dirty || !!file || !!title || !!alt;
  const mayLeave = () => !unsaved || window.confirm('저장하지 않은 입력을 버릴까요?');
  async function logout() {
    if (!client || busy || !mayLeave()) return;
    setBusy(true);
    try { const { error } = await client.auth.signOut({ scope:'local' }); if (error) throw error; }
    catch { setMessage('로그아웃 요청을 확인하지 못했습니다. 로그인 상태를 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!unsaved) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [unsaved]);
  async function refreshImages() { const result = await client!.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(100); if (result.error) throw result.error; setImages(result.data); }
  async function saveGroup(key:SettingKey){
    if(!client||!allowed||!pagesReady||busy)return;
    if(!validPageSetting(key,pages[key])){setPageMessages(current=>({...current,[key]:key==='worship_times'?'요일·주기와24시간제 시각을 확인해 주세요.':key==='offering_accounts'?'은행·예금주와 숫자/하이픈 계좌번호를 확인해 주세요.':'위치 안내 내용을 확인해 주세요.'}));return;}
    const detail=key==='offering_accounts'?'\n'+pages.offering_accounts.map(row=>`${row.key==='general'?'온라인':'건축'} 헌금: ${row.bank} ${row.number} / ${row.holder}`).join('\n'):key==='location'?`\n현재 저장 주소: ${savedFields.find(row=>row.key==='address')?.body||CHURCH_ADDRESS}`:'';
    if(!window.confirm(`${settingLabels[key]} 설정을 공개 화면에 반영할까요?${detail}`))return;
    setBusy(true);setMessage('');try{const row=await savePageSetting(client,key,pageVersions[key],pages[key]);setPages(current=>({...current,[key]:row.payload} as ChurchPageSettings));setSavedPages(current=>({...current,[key]:row.payload} as ChurchPageSettings));setPageVersions(current=>({...current,[key]:row.revision}));setPageMessages(current=>({...current,[key]:'저장했습니다. 공개 안내에 반영됩니다.'}));}catch(e){setPageMessages(current=>({...current,[key]:(e as {code?:string}).code==='23505'?'다른 곳에서 먼저 등록했습니다. 입력을 보관한 뒤 다시 불러와 주세요.':errorMessage(e)}));}finally{setBusy(false);}
  }
  async function reloadGroup(key:SettingKey){if(!client||busy)return;if(JSON.stringify(pages[key])!==JSON.stringify(savedPages[key])&&!window.confirm('이 묶음의 수정 내용을 버리고 현재 저장값을 불러올까요?'))return;setBusy(true);try{const r=await client.from('church_page_settings').select('*').eq('key',key).maybeSingle();if(r.error)throw r.error;const current=readPageSettings(r.data?[r.data]:[]);setPages(value=>({...value,[key]:current.values[key]}));setSavedPages(value=>({...value,[key]:current.values[key]}));setPageVersions(value=>({...value,[key]:current.revisions[key]}));setPageMessages(value=>({...value,[key]:'현재 저장된 설정을 불러왔습니다.'}));}catch(e){setPageMessages(value=>({...value,[key]:errorMessage(e)}));}finally{setBusy(false);}}
  async function saveInfo(){
    if(!client||!allowed||busy||!infoDirty)return;
    setBusy(true);setInfoMessage('');
    try{const result=(await saveChurchInfo(client,fields)).map(effectiveField);setFields(result);setSavedFields(result);setInfoMessage('저장했습니다.');}
    catch(error){setInfoMessage(errorMessage(error));}finally{setBusy(false);}
  }
  async function reloadInfo(){
    if(!client||!allowed||busy)return;
    if(infoDirty&&!window.confirm('교회 안내의 수정 내용을 버리고 저장된 내용을 불러올까요?'))return;
    setBusy(true);setInfoMessage('');
    try{const {data,error}=await client.from('church_info').select('*').order('key');if(error)throw error;const result=data.map(effectiveField);setFields(result);setSavedFields(result);setInfoMessage('저장된 내용을 불러왔습니다.');}
    catch(error){setInfoMessage(errorMessage(error));}finally{setBusy(false);}
  }
  async function imageRequest(method: "POST" | "DELETE", id?: string) {
    if (!client || !allowed || busy) return;
    if (method === "DELETE" && !window.confirm("사용하지 않는 이미지를 삭제할까요? 주보에서 사용 중인 이미지는 삭제되지 않습니다.")) return;
    if (method === "POST" && (!file || !title.trim() || !alt.trim())) { setMessage("이미지 파일, 제목, 이미지 설명을 입력해 주세요."); return; }
    if (file && file.size > 8 * 1024 * 1024) { setMessage("8MB 이하의 이미지를 선택해 주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const token = (await client!.auth.getSession()).data.session?.access_token;
      if (!token) { setAllowed(false); throw new Error("관리자 로그인이 필요합니다."); }
      const response = await fetch(`/api/images${id ? `?id=${id}` : ""}`, { method, headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "x-image-title": encodeURIComponent(title), "x-image-alt": encodeURIComponent(alt) } : {}) }, ...(method === "POST" ? { body: file } : {}) });
      const data = await response.json(); if (!response.ok) { if (response.status === 401) setAllowed(false); throw new Error(data.error); }
      if (method === "POST") { setFile(null); setTitle(""); setAlt(""); if (fileInput.current) fileInput.current.value = ""; }
      await refreshImages(); setMessage(method === "POST" ? "이미지를 올렸습니다. 주보 편집 화면에서 선택해 넣을 수 있습니다." : "이미지를 삭제했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리하지 못했습니다."); } finally { setBusy(false); }
  }
  const order=['name','introduction','address','directions','phone','worship'];
  const displayedFields=[...fields].sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key));
  const intro=<ManagementHeading id="church-heading" eyebrow="ABOUT OUR CHURCH" title="교회 정보·이미지 관리" description="저장하면 공개 안내에 반영됩니다. 기존 주보의 내용은 바뀌지 않습니다."/>;
  return <AdminShell active="church" intro={intro} authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} sections={[...displayedFields.map(field=>({id:`church-field-${field.key}`,label:churchLabels[field.key]})),...(pagesReady?(Object.keys(defaultPageSettings) as SettingKey[]).map(key=>({id:`page-setting-${key}`,label:settingLabels[key]})):[]),{id:'church-images',label:'이미지 보관함'}]}><main id="admin-content" aria-labelledby="church-heading" tabIndex={-1} className={`${styles.page} ${ui.surface} ${church.surface}`}>
    {allowed&&message?<p data-page-message role="status" className={`${styles.message} ${ui.feedback}`}>{message}</p>:null}{!allowed ? <ReauthPanel message={message} hasDraft={unsaved} onRetry={()=>{setMessage('로그인 상태를 확인하고 있습니다…');setReload(n=>n+1);}}/> : <>
      <section id="church-info" aria-label="교회 안내" className={church.section}><SectionHeading title="교회 안내" dirty={infoDirty} busy={busy} onSave={()=>void saveInfo()} onReload={()=>void reloadInfo()} saveLabel="교회 안내 저장" reloadLabel="교회 안내 다시 불러오기"/>
      {infoMessage?<p role="status" className={`${ui.feedback} ${church.feedback}`}>{infoMessage}</p>:null}<fieldset disabled={busy} className={styles.fields}>
        {displayedFields.map(field=><section key={field.key} id={`church-field-${field.key}`} tabIndex={-1} aria-label={`${churchLabels[field.key]} 편집`} className={`${ui.infoField} ${church.infoField}`}><div className={`${ui.infoLabel} ${church.infoLabel}`}><label htmlFor={`church-${field.key}`}>{churchLabels[field.key]}</label></div><div className={ui.infoControl}>
        <textarea id={`church-${field.key}`} rows={field.key==='introduction'?5:field.key==='directions'||field.key==='worship'?3:1} maxLength={10000} placeholder={defaultInfo[field.key]||''} value={field.body} onChange={e=>{const value=e.target.value;setFields(current=>current.map(row=>row.key===field.key?{...row,body:value}:row));setInfoMessage('');}}/>
</div></section>)}
      </fieldset></section>
      {pagesReady?<PageSettingsEditor value={pages} saved={savedPages} busy={busy} messages={pageMessages} onChange={(key,payload)=>{setPages(current=>({...current,[key]:payload}));setPageMessages(current=>({...current,[key]:''}));}} onSave={key=>void saveGroup(key)} onReload={key=>void reloadGroup(key)}/>:<section className={ui.flat}><p role="status">예배시간·계좌·지도 설정을 불러오지 못했습니다. 기존 정보는 계속 편집할 수 있습니다.</p><button onClick={()=>setReload(n=>n+1)}>페이지 설정 다시 확인</button></section>}
      <section id="church-images" tabIndex={-1} className={church.section}><ImageLibrary images={images} busy={busy} file={file} title={title} alt={alt} fileInput={fileInput} onTitle={setTitle} onAlt={setAlt} onFile={setFile} onUpload={()=>void imageRequest('POST')} onDelete={id=>void imageRequest('DELETE',id)} onRefresh={()=>void refreshImages().catch(()=>setMessage('이미지 목록을 불러오지 못했습니다.'))} onCancel={()=>{setFile(null);setTitle('');setAlt('');if(fileInput.current)fileInput.current.value='';}}/>
      </section></>}
  </main></AdminShell>;
}
