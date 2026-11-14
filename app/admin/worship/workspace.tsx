'use client';

import {useEffect,useRef,useState} from 'react';
import {makeBrowserClient,errorMessage} from '@/lib/bulletin-store';
import {worshipTypes,YOUTUBE_CHANNEL} from '@/lib/site-content';
import {youtubeId,type WorshipEntry} from '@/lib/worship-library';
import SiteIcon from '@/app/site-icon';
import DateRange from './date-range';
import video from './workspace.module.css';
import AdminShell from '../admin-shell';
import ReauthPanel from '../reauth-panel';
import ManagementHeading from '../management-heading';
import ui from '../management.module.css';
import styles from '../bulletins/workspace.module.css';
type Draft=Omit<WorshipEntry,'updated_at'>;
export default function WorshipWorkspace(){
 const [client]=useState(makeBrowserClient),[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false);
 const [rows,setRows]=useState<WorshipEntry[]>([]),[entry,setEntry]=useState<Draft|null>(null),[link,setLink]=useState('');
 const [dirty,setDirty]=useState(false),[message,setMessage]=useState('로그인을 확인하고 있습니다…'),[reload,setReload]=useState(0),[more,setMore]=useState(false);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all');
 const [view,setView]=useState<'library'|'editor'>('library'),[dates,setDates]=useState({start:'',end:''});
 const titleEdited=useRef(false);
 const owner=useRef<string|null>(null);
 useEffect(()=>{if(!allowed||!['저장했습니다.','공개 목록에서 내렸습니다.','임시 저장했습니다.'].includes(message))return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),3500);return()=>clearTimeout(timer);},[allowed,message]);
 useEffect(()=>{if(!client)return;let active=true;
  async function load(){try{
   const user=await client!.auth.getUser();if(user.error||!user.data.user)throw new Error('login');
   const member=await client!.from('church_editors').select('user_id').eq('user_id',user.data.user.id).maybeSingle();if(member.error||!member.data)throw new Error('login');
   const list=await client!.from('worship_videos').select('*').order('service_date',{ascending:false}).order('id',{ascending:false}).range(0,99);if(list.error)throw list.error;
   if(!active)return;if(owner.current&&owner.current!==user.data.user.id){setView('library');setEntry(null);setLink('');setDirty(false);}owner.current=user.data.user.id;
   setAllowed(true);setRows(list.data);setMore(list.data.length===100);setMessage('');
  }catch(error){if(active){setAllowed(false);setMessage((error as {code?:string}).code==='PGRST205'?'영상 관리 DB 적용이 필요합니다. 기존 주보·교회 정보 기능은 그대로 이용할 수 있습니다.':'관리자 로그인이 필요합니다. 같은 계정으로 다시 로그인하면 이 탭의 입력을 이어갈 수 있습니다.');}}}
  void load();const {data:{subscription}}=client.auth.onAuthStateChange(event=>{if(!active)return;if(event==='SIGNED_OUT'){setAllowed(false);setRows([]);setMessage('로그인이 종료되었습니다. 같은 계정으로 다시 로그인해 주세요.');}if(event==='SIGNED_IN')setReload(n=>n+1);});
  return()=>{active=false;subscription.unsubscribe();};
 },[client,reload]);
 const mayLeave=()=>!dirty||window.confirm('저장하지 않은 영상 정보를 버릴까요?');
 useEffect(()=>{if(!dirty)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 const change=(values:Partial<Draft>)=>{setEntry(current=>current?{...current,...values}:null);setDirty(true);setMessage('');};
 async function logout(){if(!client||busy||!mayLeave())return;setBusy(true);try{const r=await client.auth.signOut({scope:'local'});if(r.error)throw r.error;}catch{setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function loadMore(){if(!client||busy)return;setBusy(true);try{const r=await client.from('worship_videos').select('*').order('service_date',{ascending:false}).order('id',{ascending:false}).range(rows.length,rows.length+99);if(r.error)throw r.error;setRows(current=>[...current,...r.data.filter(row=>!current.some(x=>x.id===row.id))]);setMore(r.data.length===100);}catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}}
 async function save(status:WorshipEntry['status']){
  if(!client||!allowed||!entry||busy)return;const videoId=youtubeId(link);
  if(!videoId||!entry.title.trim()||!entry.service_date){setMessage('예배 날짜·제목·올바른 YouTube 영상 링크를 입력해 주세요.');return;}
  if(status==='published'&&!window.confirm('이 영상 정보를 공개 저장할까요? 대표로 지정하면 기존 대표 영상이 바뀝니다.'))return;
  if(status==='archived'&&!window.confirm('공개 목록에서 내릴까요? 영상 정보는 남습니다.'))return;
  if(status==='draft'&&entry.status==='published'&&!window.confirm('공개를 취소하고 임시 저장할까요?'))return;
  titleEdited.current=true;setBusy(true);setMessage('');try{
   const r=await client.rpc('save_worship_video',{p_id:entry.id,p_revision:entry.revision,p_type:entry.service_type,p_date:entry.service_date,p_video:videoId,p_title:entry.title,p_status:status,p_featured:entry.featured&&status==='published'});if(r.error)throw r.error;
   setEntry(r.data);setLink(`https://www.youtube.com/watch?v=${r.data.video_id}`);setDirty(false);
   const list=await client.from('worship_videos').select('*').order('service_date',{ascending:false}).order('id',{ascending:false}).range(0,99);
   if(list.error){setMessage('저장했습니다. 목록을 다시 불러오지 못했으므로 새로고침해 주세요.');return;}
   setRows(list.data);setMore(list.data.length===100);setMessage(status==='published'?'저장했습니다.':status==='archived'?'공개 목록에서 내렸습니다.':'임시 저장했습니다.');
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
 function openEditor(){if(view==='editor'||!mayLeave())return;setEntry({id:crypto.randomUUID(),service_type:'sunday',service_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),video_id:'',title:'',status:'draft',featured:false,revision:0});setLink('');setDirty(false);titleEdited.current=false;setMessage('');setView('editor');}
 function openLibrary(){if(view==='library'||!mayLeave())return;setView('library');setEntry(null);setLink('');setDirty(false);setMessage('');}

 const filtered=rows.filter(row=>(filter==='all'||row.service_type===filter)&&(!dates.start||row.service_date>=dates.start)&&(!dates.end||row.service_date<=dates.end)&&`${row.title} ${row.service_date}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const intro=<ManagementHeading id="worship-heading" eyebrow="WORSHIP & WORD" title="예배 영상 관리"/>;
 return <AdminShell active="worship" intro={intro} authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} pages={[{id:'library',label:'영상 목록',active:view==='library',onSelect:openLibrary,sections:[{id:'video-library',label:'목록·검색'}]},{id:'editor',label:entry&&entry.revision>0?'영상 수정':'영상 등록',active:view==='editor',onSelect:openEditor,sections:[{id:'video-details',label:'영상 정보'},{id:'video-publication',label:'저장'}]}]}><main id="admin-content" aria-labelledby="worship-heading" tabIndex={-1} className={`${styles.page} ${ui.surface}`}>
  {allowed&&message?<p role="status" className={`${styles.message} ${ui.feedback}`}>{message}</p>:null}
  {!allowed?<ReauthPanel message={message} hasDraft={dirty} onRetry={()=>{setMessage('로그인 상태를 확인하고 있습니다…');setReload(n=>n+1);}}/>:<>
   {view==='library'?<section id="video-library" tabIndex={-1} className={ui.flat}><div className={ui.heading}><h2>영상 목록</h2><div className={video.actions}><a href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer" aria-label="교회 YouTube 채널"><SiteIcon name="youtube" size={22}/><span>YouTube</span></a><button className={video.icon} aria-label="목록 새로고침" title="목록 새로고침" disabled={busy} onClick={()=>setReload(n=>n+1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></svg></button></div></div>
   <div className={video.chips} role="group" aria-label="예배 종류 필터">{[{key:'all',name:'모든 예배'},...worshipTypes].map(row=><button key={row.key} aria-pressed={filter===row.key} onClick={()=>setFilter(row.key)}>{row.name}</button>)}</div>
   <div className={video.search}><input type="search" aria-label="영상 검색" placeholder="제목 검색" value={query} onChange={e=>setQuery(e.target.value)}/><DateRange value={dates} onChange={setDates}/></div>
   <ul className={ui.rowsList}>{filtered.map(row=><li key={row.id}><button disabled={busy} aria-pressed={entry?.id===row.id} onClick={()=>{if(mayLeave()){titleEdited.current=true;setView('editor');setEntry({...row});setLink(`https://www.youtube.com/watch?v=${row.video_id}`);setDirty(false);setMessage('');}}}><div><strong>{row.title}</strong><span>{row.service_date} · {worshipTypes.find(w=>w.key===row.service_type)?.name}</span></div><small className={ui.badge}>{row.status==='published'?'공개':row.status==='archived'?'공개 안 함':'임시 저장'}{row.featured?' · 대표':''}</small></button></li>)}</ul>{!filtered.length?<p className={video.empty}>{rows.length?'검색 조건에 맞는 영상이 없습니다.':'등록된 영상이 없습니다.'}</p>:null}{more?<button disabled={busy} onClick={()=>void loadMore()}>이전 등록 영상 더 보기</button>:null}{more?<p className={ui.note}>불러온 영상에서 검색합니다.</p>:null}</section>:null}
   {view==='editor'&&entry?<fieldset disabled={busy} className={styles.fields}><section id="video-details" tabIndex={-1} className={ui.flat}><div className={ui.heading}><h2>{entry.revision?'영상 수정':'영상 등록'}</h2><span className={ui.status}>{dirty?'수정 중':'최신 버전'}</span></div>
    <div className={ui.row}><label htmlFor="video-type">종류</label><select id="video-type" value={entry.service_type} onChange={e=>change({service_type:e.target.value})}>{worshipTypes.map(w=><option key={w.key} value={w.key}>{w.name}</option>)}</select></div>
    <div className={ui.row}><label htmlFor="video-date">날짜</label><input id="video-date" type="date" min="1900-01-01" max="2199-12-31" value={entry.service_date} onChange={e=>change({service_date:e.target.value})}/></div>
    <div className={ui.row}><label htmlFor="video-link">링크</label><input id="video-link" type="text" maxLength={2048} value={link} placeholder="https://www.youtube.com/watch?v=…" onChange={e=>{titleEdited.current=false;setLink(e.target.value);setDirty(true);setMessage('');}}/></div>
    <div className={ui.row}><label htmlFor="video-title">제목</label><div className={ui.counted}><input id="video-title" maxLength={200} value={entry.title} onChange={e=>{titleEdited.current=true;change({title:e.target.value});}}/><span aria-hidden="true">{entry.title.length}/200</span></div></div></section>
    {id?<div id="video-preview" className={video.preview}><iframe className={styles.videoPreview} title="등록할 예배 영상 확인" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} allowFullScreen/></div>:null}
    <section id="video-publication" aria-label="영상 저장" tabIndex={-1} className={ui.flat}><label className={styles.check}><input type="checkbox" checked={entry.featured} onChange={e=>change({featured:e.target.checked})}/>이 예배의 대표 영상으로 지정</label><div className={video.save}><button disabled={!dirty&&entry.status==='draft'} onClick={()=>void save('draft')}>임시 저장</button><button disabled={!dirty&&entry.status==='published'} className={styles.primary} onClick={()=>void save('published')}>저장</button>{entry.revision>0&&entry.status==='published'?<button className={ui.quiet} onClick={()=>void save('archived')}>공개 목록에서 내리기</button>:null}</div></section>
   </fieldset>:null}
  </>}
 </main></AdminShell>;
}
