'use client';

import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import {makeBrowserClient,errorMessage} from '@/lib/bulletin-store';
import {worshipTypes,YOUTUBE_CHANNEL} from '@/lib/site-content';
import {youtubeId,type WorshipEntry} from '@/lib/worship-library';
import SiteIcon from '@/app/site-icon';
import SaveButton from '../save-button';
import {useConfirm} from '../confirm-dialog';
import {DatePicker} from '../calendar';
import DateRange from './date-range';
import VideoCalendar from './video-calendar';
import video from './workspace.module.css';
import btn from '../buttons.module.css';
import AdminIcon from '../admin-icons';
import AdminShell from '../admin-shell';
import ReauthPanel from '../reauth-panel';
import ManagementHeading from '../management-heading';
import ui from '../management.module.css';
import styles from '../bulletins/workspace.module.css';
type Draft=Omit<WorshipEntry,'updated_at'>;
const dawnLabels={monthly:'월삭새벽예배',special:'특별새벽기도'} as const;
const dawnChips={monthly:'월삭',special:'특새'} as const;
const PAGE_SIZE=20;
type Client=NonNullable<ReturnType<typeof makeBrowserClient>>;
/** Loads every video (newest first) in 1000-row batches; the list is paged on screen. */
async function loadVideos(client:Client){const all:WorshipEntry[]=[];for(let from=0;;from+=1000){const r=await client.from('worship_videos').select('*').order('service_date',{ascending:false}).order('id',{ascending:false}).range(from,from+999);if(r.error)return {data:null,error:r.error};all.push(...r.data);if(r.data.length<1000)return {data:all,error:null};}}
export default function WorshipWorkspace(){
 const [confirm,confirmDialog]=useConfirm();
 const [client]=useState(makeBrowserClient),[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false);
 const [rows,setRows]=useState<WorshipEntry[]>([]),[entry,setEntry]=useState<Draft|null>(null),[link,setLink]=useState('');
 const [dirty,setDirty]=useState(false),[message,setMessage]=useState('로그인을 확인하고 있습니다…'),[reload,setReload]=useState(0),[page,setPage]=useState(1);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const [view,setView]=useState<'library'|'calendar'|'editor'>('library'),[month,setMonth]=useState(''),[dates,setDates]=useState({start:'',end:''});
 const titleEdited=useRef(false);
 const owner=useRef<string|null>(null);
 useEffect(()=>{if(!allowed||!['저장했습니다.','공개 목록에서 내렸습니다.','임시 저장했습니다.'].includes(message))return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),3500);return()=>clearTimeout(timer);},[allowed,message]);
 useEffect(()=>{if(!client)return;let active=true;
  async function load(){try{
   const user=await client!.auth.getUser();if(user.error||!user.data.user)throw new Error('login');
   const member=await client!.from('church_editors').select('user_id').eq('user_id',user.data.user.id).maybeSingle();if(member.error||!member.data)throw new Error('login');
   const list=await loadVideos(client!);if(list.error)throw list.error;
   if(!active)return;if(owner.current&&owner.current!==user.data.user.id){setView('library');setEntry(null);setLink('');setDirty(false);}owner.current=user.data.user.id;
   setAllowed(true);setRows(list.data);setMessage('');
  }catch(error){if(active){setAllowed(false);setMessage((error as {code?:string}).code==='PGRST205'?'영상 관리 DB 적용이 필요합니다. 기존 주보·교회 정보 기능은 그대로 이용할 수 있습니다.':'관리자 로그인이 필요합니다. 같은 계정으로 다시 로그인하면 이 탭의 입력을 이어갈 수 있습니다.');}}}
  void load();const {data:{subscription}}=client.auth.onAuthStateChange(event=>{if(!active)return;if(event==='SIGNED_OUT'){setAllowed(false);setRows([]);setMessage('로그인이 종료되었습니다. 같은 계정으로 다시 로그인해 주세요.');}if(event==='SIGNED_IN')setReload(n=>n+1);});
  return()=>{active=false;subscription.unsubscribe();};
 },[client,reload]);
 const mayLeave=()=>!dirty||confirm({title:'저장하지 않은 영상 정보를 버릴까요?',message:'지금 나가면 입력한 내용이 사라집니다.',confirmLabel:'버리기',tone:'danger'});
 useEffect(()=>{if(!dirty)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 const change=(values:Partial<Draft>)=>{setEntry(current=>current?{...current,...values}:null);setDirty(true);setMessage('');};
 async function logout(){if(!client||busy||!(await mayLeave()))return;setBusy(true);try{const r=await client.auth.signOut({scope:'local'});if(r.error)throw r.error;}catch{setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function save(status:WorshipEntry['status']){
  if(!client||!allowed||!entry||busy)return;const videoId=youtubeId(link);
  if(!videoId||!entry.title.trim()||!entry.service_date){setMessage('예배 날짜·제목·올바른 YouTube 영상 링크를 입력해 주세요.');return;}
  if(status==='published'&&!await confirm({title:'이 영상 정보를 공개 저장할까요?',message:entry.featured?'대표로 지정하면 기존 대표 영상이 바뀝니다.':'공개 목록에 바로 나타납니다.',confirmLabel:'공개 저장'}))return;
  if(status==='archived'&&!await confirm({title:'공개 목록에서 내릴까요?',message:'영상 정보는 남습니다.',confirmLabel:'내리기'}))return;
  if(status==='draft'&&entry.status==='published'&&!await confirm({title:'공개를 취소하고 임시 저장할까요?',message:'공개 목록에서 내려갑니다.',confirmLabel:'임시 저장'}))return;
  titleEdited.current=true;setBusy(true);setMessage('');try{
   const kinds=entry.service_type==='dawn'?(entry.dawn_kinds??[]):[],before=rows.find(row=>row.id===entry.id)?.dawn_kinds??[];
   // A dawn tag must be cleared before the type changes (DB constraint).
   if(entry.service_type!=='dawn'&&before.length){const c=await client.from('worship_videos').update({dawn_kinds:[]}).eq('id',entry.id);if(c.error)throw c.error;}
   const r=await client.rpc('save_worship_video',{p_id:entry.id,p_revision:entry.revision,p_type:entry.service_type,p_date:entry.service_date,p_video:videoId,p_title:entry.title,p_status:status,p_featured:entry.featured&&status==='published'});if(r.error)throw r.error;
   let saved=r.data as WorshipEntry,note='';
   if(kinds.length||before.length){const k=await client.from('worship_videos').update({dawn_kinds:kinds}).eq('id',saved.id).select('*').single();if(k.error)note=' 새벽 구분은 DB 업데이트 후 저장할 수 있습니다.';else saved=k.data;}
   setEntry(saved);setLink(`https://www.youtube.com/watch?v=${saved.video_id}`);setDirty(false);
   const list=await loadVideos(client);
   if(list.error){setMessage('저장했습니다. 목록을 다시 불러오지 못했으므로 새로고침해 주세요.');return;}
   setRows(list.data);setMessage((status==='published'?'저장했습니다.':status==='archived'?'공개 목록에서 내렸습니다.':'임시 저장했습니다.')+note);
   if(status==='published'){setView('library');setEntry(null);setLink('');}
  }catch(e){setMessage((e as {code?:string}).code==='23505'?'같은 예배 종류에 이미 등록된 영상입니다. 기존 영상을 선택해 수정해 주세요.':errorMessage(e));}finally{setBusy(false);}
 }
 const id=youtubeId(link);
 useEffect(()=>{
  if(!id||!allowed||!client||view!=='editor')return;
  const controller=new AbortController();let active=true;
  const timer=setTimeout(async()=>{try{
   const {data}=await client.auth.getSession();if(!active||!data.session)return;
   const response=await fetch(`/api/worship/title?id=${id}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},signal:controller.signal});
   if(!response.ok)throw new Error('title');const result=await response.json();
   if(active&&!titleEdited.current&&typeof result.title==='string'){setEntry(current=>current?{...current,title:result.title.slice(0,200)}:null);setDirty(true);}
  }catch{if(active&&!titleEdited.current)setMessage('제목을 가져오지 못했습니다. 직접 입력해 주세요.');}},400);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[id,allowed,client,view]);
 async function openEditor(){if(view==='editor'||!(await mayLeave()))return;setEntry({id:crypto.randomUUID(),service_type:'sunday',service_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),video_id:'',title:'',status:'draft',featured:false,revision:0,dawn_kinds:[]});setLink('');setDirty(false);titleEdited.current=false;setMessage('');setView('editor');}
 async function openLibrary(){if(view==='library'||!(await mayLeave()))return;setView('library');setEntry(null);setLink('');setDirty(false);setMessage('');}
 async function openCalendar(){if(view==='calendar'||!(await mayLeave()))return;if(!month)setMonth(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7));setView('calendar');setEntry(null);setLink('');setDirty(false);setMessage('');}
 async function openRow(row:WorshipEntry){if(!(await mayLeave()))return;titleEdited.current=true;setView('editor');setEntry({...row,dawn_kinds:row.dawn_kinds??[]});setLink(`https://www.youtube.com/watch?v=${row.video_id}`);setDirty(false);setMessage('');}

 const filtered=rows.filter(row=>(filter==='all'||row.service_type===filter)&&(!dates.start||row.service_date>=dates.start)&&(!dates.end||row.service_date<=dates.end)&&`${row.title} ${row.service_date}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),current=Math.min(page,pages),shown=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 const intro=<ManagementHeading id="worship-heading" eyebrow="WORSHIP & WORD" title="예배 영상 관리"/>;
 return <><AdminShell active="worship" intro={intro} authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} pages={[{id:'library',label:'영상 목록',active:view==='library',onSelect:openLibrary,sections:[{id:'video-library',label:'목록·검색'}]},{id:'calendar',label:'캘린더',active:view==='calendar',onSelect:openCalendar,sections:[]},...(view==='editor'?[{id:'editor',label:entry&&entry.revision>0?'영상 수정':'영상 등록',active:true,onSelect:()=>{},sections:[{id:'video-details',label:'영상 정보'},{id:'video-publication',label:'저장'}]}]:[])]}><main id="admin-content" aria-labelledby="worship-heading" tabIndex={-1} className={`${styles.page} ${ui.surface}`}>
  {allowed&&message?<p role="status" className={`${styles.message} ${ui.feedback}`}>{message}</p>:null}
  {!allowed?<ReauthPanel message={message} hasDraft={dirty} onRetry={()=>{setMessage('로그인 상태를 확인하고 있습니다…');setReload(n=>n+1);}}/>:<>
   {view==='library'?<section id="video-library" tabIndex={-1} className={`${ui.flat} ${video.noRule}`}><div className={ui.heading}><h2>영상 목록</h2><div className={video.actions}><a href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer" className={`${btn.btn} ${btn.ghost}`} aria-label="교회 YouTube 채널"><SiteIcon name="youtube" size={18}/><span>YouTube</span></a><button type="button" className={`${btn.btn} ${btn.primary}`} disabled={busy} onClick={openEditor}><AdminIcon name="plus" size={15}/>영상 등록</button></div></div>
   <div className={`${btn.chips} ${video.filter}`} role="group" aria-label="예배 종류 필터">{[{key:'all',name:'모든 예배'},...worshipTypes].map(row=><button key={row.key} aria-pressed={filter===row.key} onClick={()=>{setFilter(row.key);setPage(1);}}>{row.name}</button>)}</div>
   <div className={video.search}><input type="search" aria-label="영상 검색" placeholder="제목 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/><DateRange value={dates} onChange={value=>{setDates(value);setPage(1);}}/></div>
   <ul className={`${ui.rowsList} ${video.pagedList}`}>{shown.map(row=><li key={row.id}><button disabled={busy} aria-pressed={entry?.id===row.id} className={video.videoRow} onClick={()=>openRow(row)}><Image className={video.thumb} src={`https://i.ytimg.com/vi/${row.video_id}/mqdefault.jpg`} alt="" width={112} height={63} unoptimized/><div className={video.rowMain}><span className={video.typeChip} data-type={row.service_type}>{worshipTypes.find(w=>w.key===row.service_type)?.name}</span><span className={video.titleLine}><strong>{row.title}</strong><time dateTime={row.service_date}>{row.service_date.replace(/-/g,'.')}</time></span></div><span className={video.badges}><small className={ui.badge} data-state={row.status}>{row.status==='published'?'공개':row.status==='archived'?'공개 안 함':'임시 저장'}</small>{row.featured?<small className={`${ui.badge} ${video.featuredBadge}`}>대표</small>:null}{(row.dawn_kinds??[]).map(kind=><small key={kind} className={ui.badge} title={dawnLabels[kind as keyof typeof dawnLabels]}>{dawnChips[kind as keyof typeof dawnChips]??kind}</small>)}</span></button></li>)}</ul>{!filtered.length?<p className={video.empty}>{rows.length?'검색 조건에 맞는 영상이 없습니다.':'등록된 영상이 없습니다.'}</p>:null}{pages>1?<nav className={video.pager} aria-label="영상 목록 페이지"><button type="button" aria-label="이전 페이지" disabled={current===1} onClick={()=>setPage(current-1)}>‹</button>{Array.from({length:pages},(_,i)=>i+1).filter(n=>n===1||n===pages||Math.abs(n-current)<=2).map((n,i,list)=><span key={n}>{i&&n-list[i-1]>1?<span className={video.gap} aria-hidden="true">…</span>:null}<button type="button" aria-label={`${n}페이지`} aria-current={n===current?'page':undefined} onClick={()=>setPage(n)}>{n}</button></span>)}<button type="button" aria-label="다음 페이지" disabled={current===pages} onClick={()=>setPage(current+1)}>›</button></nav>:null}</section>:null}
   {view==='calendar'&&month?<VideoCalendar month={month} onMonth={setMonth} rows={rows.filter(row=>filter==='all'||row.service_type===filter)} filter={filter} onFilter={setFilter} onOpen={openRow} busy={busy}/>:null}
   {view==='editor'&&entry?<fieldset disabled={busy} className={`${styles.fields} ${video.editor}`}><section id="video-details" tabIndex={-1} className={ui.flat}><div className={ui.heading}><h2>{entry.revision?'영상 수정':'영상 등록'}</h2></div>
    <div className={`${ui.row} ${video.formRow}`}><span className={video.rowLabel}>종류</span><div id="video-type" className={btn.chips} role="group" aria-label="종류">{worshipTypes.map(w=><button type="button" key={w.key} aria-pressed={entry.service_type===w.key} onClick={()=>change({service_type:w.key,...(w.key==='dawn'?{}:{dawn_kinds:[]})})}>{w.name}</button>)}</div></div>
    {entry.service_type==='dawn'?<div className={`${ui.row} ${video.formRow}`}><span className={video.rowLabel}>구분</span><div className={video.kinds} role="group" aria-label="새벽 예배 구분">{(Object.keys(dawnLabels) as (keyof typeof dawnLabels)[]).map(kind=><label key={kind} className={styles.check}><input type="checkbox" checked={(entry.dawn_kinds??[]).includes(kind)} onChange={e=>change({dawn_kinds:e.target.checked?[...(entry.dawn_kinds??[]),kind]:(entry.dawn_kinds??[]).filter(k=>k!==kind)})}/>{dawnLabels[kind]}</label>)}</div></div>:null}
    <div className={`${ui.row} ${video.formRow}`}><label htmlFor="video-date">날짜</label><DatePicker id="video-date" label="날짜" value={entry.service_date} onChange={value=>change({service_date:value})}/></div>
    <div className={`${ui.row} ${video.formRow}`}><label htmlFor="video-link">링크</label><input id="video-link" type="text" maxLength={2048} value={link} placeholder="https://www.youtube.com/watch?v=…" onChange={e=>{titleEdited.current=false;setLink(e.target.value);setDirty(true);setMessage('');}}/></div>
    <div className={`${ui.row} ${video.formRow}`}><label htmlFor="video-title">제목</label><div className={ui.counted}><input id="video-title" maxLength={200} value={entry.title} onChange={e=>{titleEdited.current=true;change({title:e.target.value});}}/><span aria-hidden="true">{entry.title.length}/200</span></div></div></section>
    {id?<div id="video-preview" className={video.preview}><iframe className={styles.videoPreview} title="등록할 예배 영상 확인" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} allowFullScreen/></div>:null}
    <section id="video-publication" aria-label="영상 저장" tabIndex={-1} className={ui.flat}><label className={styles.check}><input type="checkbox" checked={entry.featured} onChange={e=>change({featured:e.target.checked})}/>이 예배의 대표 영상으로 지정</label><div className={video.save}><SaveButton disabled={busy||!dirty&&entry.status==='draft'} onClick={()=>void save('draft')}>임시 저장</SaveButton><SaveButton disabled={busy||!dirty&&entry.status==='published'} className={styles.primary} onClick={()=>void save('published')}>저장</SaveButton>{entry.revision>0&&entry.status==='published'?<button className={ui.quiet} onClick={()=>void save('archived')}>공개 목록에서 내리기</button>:null}</div></section>
   </fieldset>:null}
  </>}
 </main></AdminShell>{confirmDialog}</>;
}
