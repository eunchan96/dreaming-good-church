"use client";
import { useEffect, useRef, useState } from "react";
import { makeBrowserClient, errorMessage } from "@/lib/bulletin-store";
import { churchLabels, type ChurchField, type BulletinImage } from "@/lib/church";
import ImageLibrary from "./image-library";
import { homeTabs } from "../home-tabs";
import PortraitField, { type PortraitDraft } from "./portrait-field";
import { checkImageFile, updateImage, uploadImage, withFolder } from "@/lib/image-upload";
import styles from "../bulletins/workspace.module.css";
import AdminShell from '../admin-shell';
import {useConfirm} from '../confirm-dialog';
import ReauthPanel from '../reauth-panel';
import ManagementHeading from '../management-heading';
import ui from '../management.module.css';
import SectionHeading from './section-heading';
import church from './workspace.module.css';
import { saveChurchInfo } from '@/lib/church-info-store';
import { CHURCH_ADDRESS,CHURCH_PHONE,CHURCH_VISIT } from '@/lib/site-content';
import {defaultPageSettings,settingLabels,validPageSetting,type ChurchPageSettings,type SettingKey} from '@/lib/church-page-settings';
import {readPageSettings,savePageSetting} from '@/lib/church-page-store';
import {SettingFields} from './page-settings-editor';
import {churchCopyDefaults} from '@/lib/church-copy';
const defaultInfo:Record<string,string>={...churchCopyDefaults,name:'꿈꾸는좋은교회',address:CHURCH_ADDRESS,phone:CHURCH_PHONE,directions:CHURCH_VISIT};

const effectiveField=(field:ChurchField):ChurchField=>({...field,body:field.body.trim()?field.body:defaultInfo[field.key]||field.body});

// 잠깐 떠서 사라지는 성공 안내(플로팅). 오류·안내는 화면에 그대로 남긴다.
const toastMessages=['이미지를 올렸습니다. 주보 편집 화면에서 선택해 넣을 수 있습니다.','이미지를 삭제했습니다.','이미지 정보를 저장했습니다.'];
export default function ChurchWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [allowed, setAllowed] = useState(false), [reload, setReload] = useState(0), [view, setView] = useState<'info'|'images'>(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('view')==='images'?'images':'info');
  const [fields, setFields] = useState<ChurchField[]>([]), [images, setImages] = useState<BulletinImage[]>([]);
  const [savedFields,setSavedFields]=useState<ChurchField[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("로그인을 확인하고 있습니다…");
  const [infoMessage,setInfoMessage]=useState('');
  const [pages,setPages]=useState<ChurchPageSettings>(structuredClone(defaultPageSettings)),[savedPages,setSavedPages]=useState<ChurchPageSettings>(structuredClone(defaultPageSettings));
  const [pageVersions,setPageVersions]=useState<Record<SettingKey,number>>({worship_times:0,offering_accounts:0,location:0}),[pageMessages,setPageMessages]=useState<Partial<Record<SettingKey,string>>>({}),[pagesReady,setPagesReady]=useState(false);
  const pageLoaded=useRef(false),portraitLoaded=useRef(false);
  const [portrait,setPortrait]=useState<PortraitDraft>({image_asset_id:null,alt:'',revision:0}),[savedPortrait,setSavedPortrait]=useState<PortraitDraft>({image_asset_id:null,alt:'',revision:0}),[portraitReady,setPortraitReady]=useState(false);
  useEffect(()=>{if(!['저장했습니다.','저장된 내용을 불러왔습니다.'].includes(infoMessage))return;const timer=setTimeout(()=>setInfoMessage(current=>current===infoMessage?'':current),3500);return()=>clearTimeout(timer);},[infoMessage]);
  useEffect(()=>{const success=Object.entries(pageMessages).filter(([,value])=>value==='저장했습니다. 공개 안내에 반영됩니다.'||value==='현재 저장된 설정을 불러왔습니다.');if(!success.length)return;const timer=setTimeout(()=>setPageMessages(current=>Object.fromEntries(Object.entries(current).filter(([key,value])=>!success.some(([oldKey,oldValue])=>key===oldKey&&value===oldValue)))),3500);return()=>clearTimeout(timer);},[pageMessages]);
  const [title, setTitle] = useState(""), [alt, setAlt] = useState(""), [file, setFile] = useState<File | null>(null);
  const owner = useRef<string | null>(null), loaded = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!allowed||!toastMessages.includes(message))return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),3500);return()=>clearTimeout(timer);},[allowed,message]);
  useEffect(() => {
    if (!client) return;
    let active = true;
    async function load() {
      try {
        const user = await client!.auth.getUser(); if (user.error || !user.data.user) throw new Error();
        const member = await client!.from("church_editors").select("user_id").eq("user_id", user.data.user.id).maybeSingle(); if (member.error || !member.data) throw new Error();
        const [info, assets, pageRows, portraitRow] = await Promise.all([client!.from("church_info").select("*").order("key"), client!.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(100),client!.from('church_page_settings').select('*'),client!.from('church_portrait').select('image_asset_id,alt,revision').eq('id',1).maybeSingle()]);
        if (info.error || assets.error) throw new Error();
        if (!active) return;
        const newOwner=!loaded.current || owner.current !== user.data.user.id;
        if (newOwner) { setFields(info.data.map(effectiveField)); setSavedFields(info.data.map(effectiveField));setInfoMessage('');setTitle(""); setAlt(""); setFile(null);pageLoaded.current=false;setPages(structuredClone(defaultPageSettings));setSavedPages(structuredClone(defaultPageSettings));setPageMessages({}); }
        if(!portraitRow.error&&portraitRow.data){if(newOwner||!portraitLoaded.current){setPortrait(portraitRow.data);setSavedPortrait(portraitRow.data);portraitLoaded.current=true;}setPortraitReady(true);}else setPortraitReady(false);
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
  const portraitDirty=portrait.image_asset_id!==savedPortrait.image_asset_id||portrait.alt!==savedPortrait.alt;
  const dirty=infoDirty||portraitDirty||(Object.keys(defaultPageSettings) as SettingKey[]).some(key=>JSON.stringify(pages[key])!==JSON.stringify(savedPages[key]));
  const [confirm,confirmDialog]=useConfirm();
  const unsaved = dirty || !!file || !!title || !!alt;
  const mayLeave = () => !unsaved || confirm({title:'저장하지 않은 입력을 버릴까요?',message:'지금 나가면 입력한 내용이 사라집니다.',confirmLabel:'버리기',tone:'danger'});
  async function logout() {
    if (!client || busy || !(await mayLeave())) return;
    setBusy(true);
    try { const { error } = await client.auth.signOut({ scope:'local' }); if (error) throw error; }
    catch { setMessage('로그아웃 요청을 확인하지 못했습니다. 로그인 상태를 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!unsaved) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [unsaved]);
  async function refreshImages() { const result = await client!.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(300); if (result.error) throw result.error; setImages(result.data.map(withFolder)); }
  async function editImage(id: string, changes: { title?: string; alt?: string; folder?: string }) { if (!client || busy) return false; setBusy(true); try { const saved = await updateImage(client, id, changes); setImages(current => current.map(image => image.id === id ? saved : image)); setMessage("이미지 정보를 저장했습니다."); return true; } catch (error) { setMessage(error instanceof Error ? error.message : "이미지 정보를 바꾸지 못했습니다."); return false; } finally { setBusy(false); } }
  async function saveGroup(key:SettingKey){
    if(!client||!allowed||!pagesReady||busy)return;
    if(!validPageSetting(key,pages[key])){setPageMessages(current=>({...current,[key]:key==='worship_times'?'요일·주기와24시간제 시각을 확인해 주세요.':key==='offering_accounts'?'은행·예금주와 숫자/하이픈 계좌번호를 확인해 주세요.':'위치 안내 내용을 확인해 주세요.'}));return;}
    const detail=key==='offering_accounts'?'\n'+pages.offering_accounts.map(row=>`${row.key==='general'?'온라인':'건축'} 헌금: ${row.bank} ${row.number} / ${row.holder}`).join('\n'):key==='location'?`\n현재 저장 주소: ${savedFields.find(row=>row.key==='address')?.body||CHURCH_ADDRESS}`:'';
    if(!await confirm({title:`${settingLabels[key]} 설정을 공개 화면에 반영할까요?`,message:detail.trim(),confirmLabel:'반영'}))return;
    setBusy(true);setMessage('');try{const row=await savePageSetting(client,key,pageVersions[key],pages[key]);setPages(current=>({...current,[key]:row.payload} as ChurchPageSettings));setSavedPages(current=>({...current,[key]:row.payload} as ChurchPageSettings));setPageVersions(current=>({...current,[key]:row.revision}));setPageMessages(current=>({...current,[key]:'저장했습니다. 공개 안내에 반영됩니다.'}));}catch(e){setPageMessages(current=>({...current,[key]:(e as {code?:string}).code==='23505'?'다른 곳에서 먼저 등록했습니다. 입력을 보관한 뒤 다시 불러와 주세요.':errorMessage(e)}));}finally{setBusy(false);}
  }
  async function reloadGroup(key:SettingKey,confirmed=false){if(!client||busy)return;if(!confirmed&&JSON.stringify(pages[key])!==JSON.stringify(savedPages[key])&&!await confirm({title:'이 묶음의 수정 내용을 버릴까요?',message:'현재 저장된 값을 불러옵니다.',confirmLabel:'불러오기',tone:'danger'}))return;setBusy(true);try{const r=await client.from('church_page_settings').select('*').eq('key',key).maybeSingle();if(r.error)throw r.error;const current=readPageSettings(r.data?[r.data]:[]);setPages(value=>({...value,[key]:current.values[key]}));setSavedPages(value=>({...value,[key]:current.values[key]}));setPageVersions(value=>({...value,[key]:current.revisions[key]}));setPageMessages(value=>({...value,[key]:'현재 저장된 설정을 불러왔습니다.'}));}catch(e){setPageMessages(value=>({...value,[key]:errorMessage(e)}));}finally{setBusy(false);}}
  /** Saves the given fields (one category) in the existing all-or-nothing RPC; other categories keep their unsaved edits. */
  async function savePortrait(){
    if(!client||!allowed||busy)return;
    setBusy(true);setInfoMessage('');
    try{const {data,error}=await client.from('church_portrait').update({image_asset_id:portrait.image_asset_id,alt:portrait.alt.trim(),revision:savedPortrait.revision+1}).eq('id',1).eq('revision',savedPortrait.revision).select('image_asset_id,alt,revision').maybeSingle();if(error)throw error;if(!data)throw new Error('다른 곳에서 사진을 먼저 바꿨습니다. 다시 불러온 뒤 저장해 주세요.');setPortrait(data);setSavedPortrait(data);setInfoMessage('저장했습니다.');}
    catch(error){setInfoMessage(errorMessage(error));}finally{setBusy(false);}
  }
  async function saveInfo(keys?:string[]){
    const mine=(key:string)=>!keys||keys.includes(key);
    if(!client||!allowed||busy||!fields.some(f=>mine(f.key)&&changed(f)))return;
    setBusy(true);setInfoMessage('');
    try{const payload=fields.map(f=>mine(f.key)?f:{...(savedFields.find(row=>row.key===f.key)??f),revision:f.revision});const result=(await saveChurchInfo(client,payload)).map(effectiveField);setSavedFields(result);setFields(current=>result.map(row=>mine(row.key)?row:{...(current.find(old=>old.key===row.key)??row),revision:row.revision}));setInfoMessage('저장했습니다.');}
    catch(error){setInfoMessage(errorMessage(error));}finally{setBusy(false);}
  }
  async function reloadInfo(keys?:string[]){
    if(!client||!allowed||busy)return;
    setBusy(true);setInfoMessage('');
    try{const {data,error}=await client.from('church_info').select('*').order('key');if(error)throw error;const result=data.map(effectiveField);const pick=(row:ChurchField,fallback:ChurchField[])=>!keys||keys.includes(row.key)?row:fallback.find(old=>old.key===row.key)??row;setFields(current=>result.map(row=>pick(row,current)));setSavedFields(current=>result.map(row=>pick(row,current)));setInfoMessage('저장된 내용을 불러왔습니다.');}
    catch(error){setInfoMessage(errorMessage(error));}finally{setBusy(false);}
  }
  async function imageRequest(method: "POST" | "DELETE", id?: string, folder = "") {
    if (!client || !allowed || busy) return;
    if (method === "DELETE" && !await confirm({ title: "사용하지 않는 이미지를 삭제할까요?", message: "주보에서 사용 중인 이미지는 삭제되지 않습니다.", confirmLabel: "삭제", tone: "danger" })) return;
    if (method === "POST" && !file) { setMessage("올릴 이미지를 선택해 주세요."); return; }
    const problem = method === "POST" && file ? checkImageFile(file) : ""; if (problem) { setMessage(problem); return; }
    setBusy(true); setMessage("");
    try {
      if (method === "POST" && file) { await uploadImage(client!, file, { title, alt, folder }); setFile(null); setTitle(""); setAlt(""); if (fileInput.current) fileInput.current.value = ""; }
      else {
        const token = (await client!.auth.getSession()).data.session?.access_token;
        if (!token) { setAllowed(false); throw new Error("관리자 로그인이 필요합니다."); }
        const response = await fetch(`/api/images?id=${id}`, { method, headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json(); if (!response.ok) { if (response.status === 401) setAllowed(false); throw new Error(data.error); }
      }
      await refreshImages(); setMessage(method === "POST" ? "이미지를 올렸습니다." : "이미지를 삭제했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리하지 못했습니다."); } finally { setBusy(false); }
  }
  // 교회 소개 follows the public 교회 소개 menu: 인사말 · 오시는 길 · 예배시간 안내 · 온라인 헌금.
  const categories:{id:string;title:string;fields:string[];groups:SettingKey[]}[]=[
    {id:'greeting',title:'인사말',fields:['pastor_name','name','page_lead','greeting_title','introduction','greeting_closing'],groups:[]},
    {id:'directions',title:'오시는 길',fields:['address','phone','directions'],groups:['location']},
    {id:'worship',title:'예배시간 안내',fields:['worship'],groups:['worship_times']},
    {id:'offering',title:'온라인 헌금',fields:['offering_title','offering_note'],groups:['offering_accounts']},
  ];
  const fieldLabel=(key:string)=>key==='introduction'?'인사말 글':key==='directions'?'찾아오는 길 설명':key==='worship'?'추가 안내':churchLabels[key];
  // Short notes under labels say where each piece of wording appears on the public site.
  const fieldHints:Record<string,string>={pastor_name:'인사말 끝 서명과 하단 정보에 표시',name:'인사말 위 작은 글씨와 하단 정보에 표시',page_lead:'교회 소개 모든 화면의 제목 아래 문구',greeting_title:'줄바꿈 그대로 표시',worship:'예배시간 표 아래에 표시, 비우면 숨김'};
  const fieldRows=(key:string)=>key==='introduction'?5:['directions','worship'].includes(key)?3:['greeting_title','greeting_closing','offering_title'].includes(key)?2:1;
  const groupDirty=(key:SettingKey)=>JSON.stringify(pages[key])!==JSON.stringify(savedPages[key]);
  const categoryDirty=(c:typeof categories[number])=>fields.some(f=>c.fields.includes(f.key)&&changed(f))||c.groups.some(groupDirty)||(c.id==='greeting'&&portraitDirty);
  async function saveCategory(c:typeof categories[number]){if(c.id==='greeting'&&portraitDirty)await savePortrait();if(fields.some(f=>c.fields.includes(f.key)&&changed(f)))await saveInfo(c.fields);for(const key of c.groups)if(groupDirty(key))await saveGroup(key);}
  async function reloadCategory(c:typeof categories[number]){if(categoryDirty(c)&&!await confirm({title:`${c.title}의 수정 내용을 버릴까요?`,message:'저장된 내용을 불러옵니다.',confirmLabel:'불러오기',tone:'danger'}))return;if(c.id==='greeting'&&portraitDirty)setPortrait(savedPortrait);if(c.fields.length)await reloadInfo(c.fields);for(const key of c.groups)if(groupDirty(key))await reloadGroup(key,true);}
  const intro=<ManagementHeading id="church-heading" eyebrow="HOMEPAGE CONTENT" title="홈페이지 관리"/>;
  return <><AdminShell active="church" intro={intro} authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} pages={homeTabs(view==='images'?'images':'church',view==='images'?[{id:'church-images',label:'이미지 보관함'}]:categories.map(c=>({id:`church-section-${c.id}`,label:c.title})),{canLeave:mayLeave,onSelect:tab=>{if(tab==='home')return false;setView(tab==='images'?'images':'info');history.replaceState(null,'',tab==='images'?'/admin/church?view=images':'/admin/church');return true;}})}><main id="admin-content" aria-labelledby="church-heading" tabIndex={-1} className={`${styles.page} ${ui.surface} ${church.surface}`}>
    {allowed&&message?<p data-page-message role="status" className={toastMessages.includes(message)?styles.toast:`${styles.message} ${ui.feedback}`}>{message}</p>:null}{!allowed ? <ReauthPanel message={message} hasDraft={unsaved} onRetry={()=>{setMessage('로그인 상태를 확인하고 있습니다…');setReload(n=>n+1);}}/> : <>
      {view==='info'?<>{infoMessage?<p role="status" className={`${ui.feedback} ${church.feedback}`}>{infoMessage}</p>:null}
      {categories.map(c=><section key={c.id} id={`church-section-${c.id}`} tabIndex={-1} aria-label={c.title} className={church.section}>
        <SectionHeading title={c.title} dirty={categoryDirty(c)} busy={busy} onSave={()=>void saveCategory(c)} onReload={()=>void reloadCategory(c)} saveLabel={`${c.title} 저장`} reloadLabel={`${c.title} 다시 불러오기`}/>
        <fieldset disabled={busy} className={`${styles.fields} ${ui.formRows}`}>
          {c.id==='greeting'?<div className={`${ui.infoField} ${church.infoField}`}><div className={`${ui.infoLabel} ${church.infoLabel}`}><span>목사님 사진</span></div><div className={ui.infoControl}><PortraitField value={portrait} ready={portraitReady} disabled={busy} onChange={setPortrait}/></div></div>:null}
          {c.fields.flatMap(key=>fields.filter(f=>f.key===key)).map(field=><div key={field.key} id={`church-field-${field.key}`} className={`${ui.infoField} ${church.infoField}`}><div className={`${ui.infoLabel} ${church.infoLabel}`}><label htmlFor={`church-${field.key}`}>{fieldLabel(field.key)}</label>{fieldHints[field.key]?<small className={church.fieldHint}>{fieldHints[field.key]}</small>:null}</div><div className={ui.infoControl}>
            <textarea id={`church-${field.key}`} rows={fieldRows(field.key)} maxLength={10000} placeholder={defaultInfo[field.key]||''} value={field.body} onChange={e=>{const value=e.target.value;setFields(current=>current.map(row=>row.key===field.key?{...row,body:value}:row));setInfoMessage('');}}/>
          </div></div>)}
          {pagesReady?c.groups.map(key=><div key={key} id={`page-setting-${key}`} className={church.groupFields}><SettingFields settingKey={key} value={pages} onChange={(k,payload)=>{setPages(current=>({...current,[k]:payload}));setPageMessages(current=>({...current,[k]:''}));}}/>{pageMessages[key]?<p role="status" className={`${styles.message} ${ui.feedback}`}>{pageMessages[key]}</p>:null}</div>)
            :c.groups.length?<p role="status">예배시간·계좌·지도 설정을 불러오지 못했습니다. <button type="button" onClick={()=>setReload(n=>n+1)}>다시 확인</button></p>:null}
        </fieldset>
      </section>)}
      </>:null}
      {view==='images'?<section id="church-images" tabIndex={-1} className={church.section}><ImageLibrary images={images} busy={busy} file={file} title={title} alt={alt} fileInput={fileInput} onTitle={setTitle} onAlt={setAlt} onFile={setFile} onUpload={folder=>void imageRequest('POST',undefined,folder)} onEdit={editImage} onDelete={id=>void imageRequest('DELETE',id)} onCancel={()=>{setFile(null);setTitle('');setAlt('');if(fileInput.current)fileInput.current.value='';}}/>
      </section>:null}</>}
  </main></AdminShell>{confirmDialog}</>;
}
