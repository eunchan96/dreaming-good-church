'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {makeBrowserClient,errorMessage} from '@/lib/bulletin-store';
import {worshipTypes,YOUTUBE_CHANNEL} from '@/lib/site-content';
import {youtubeId,type WorshipEntry} from '@/lib/worship-library';
import AdminShell from '../admin-shell';
import InfoTip from '../info-tip';
import styles from '../bulletins/workspace.module.css';
type Draft=Omit<WorshipEntry,'updated_at'>;
export default function WorshipWorkspace(){
 const [client]=useState(makeBrowserClient),[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false);
 const [rows,setRows]=useState<WorshipEntry[]>([]),[entry,setEntry]=useState<Draft|null>(null),[link,setLink]=useState('');
 const [dirty,setDirty]=useState(false),[message,setMessage]=useState('로그인을 확인하고 있습니다…'),[reload,setReload]=useState(0),[more,setMore]=useState(false);
 const owner=useRef<string|null>(null);
 useEffect(()=>{if(!client)return;let active=true;
  async function load(){try{
   const user=await client!.auth.getUser();if(user.error||!user.data.user)throw new Error('login');
   const member=await client!.from('church_editors').select('user_id').eq('user_id',user.data.user.id).maybeSingle();if(member.error||!member.data)throw new Error('login');
   const list=await client!.from('worship_videos').select('*').order('service_date',{ascending:false}).order('id',{ascending:false}).range(0,99);if(list.error)throw list.error;
   if(!active)return;if(owner.current&&owner.current!==user.data.user.id){setEntry(null);setLink('');setDirty(false);}owner.current=user.data.user.id;
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
  if(status==='archived'&&!window.confirm('보관하고 공개 목록에서 내릴까요? 영상 정보는 남습니다.'))return;
  setBusy(true);setMessage('');try{
   const r=await client.rpc('save_worship_video',{p_id:entry.id,p_revision:entry.revision,p_type:entry.service_type,p_date:entry.service_date,p_video:videoId,p_title:entry.title,p_status:status,p_featured:entry.featured&&status==='published'});if(r.error)throw r.error;
   setEntry(r.data);setLink(`https://www.youtube.com/watch?v=${r.data.video_id}`);setDirty(false);
   const list=await client.from('worship_videos').select('*').order('service_date',{ascending:false}).order('id',{ascending:false}).range(0,99);
   if(list.error){setMessage('저장했습니다. 목록을 다시 불러오지 못했으므로 새로고침해 주세요.');return;}
   setRows(list.data);setMore(list.data.length===100);setMessage(status==='published'?'공개 저장했습니다.':status==='archived'?'보관했습니다.':'초안으로 저장했습니다. 공개되지 않습니다.');
  }catch(e){setMessage((e as {code?:string}).code==='23505'?'같은 예배 종류에 이미 등록된 영상입니다. 기존 영상을 선택해 수정해 주세요.':errorMessage(e));}finally{setBusy(false);}
 }
 const id=youtubeId(link);
 return <AdminShell active="worship" authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} sections={[{id:'video-library',label:'영상 목록'},...(entry?[{id:'video-details',label:'예배·영상 정보'},{id:'video-preview',label:'영상 확인'},{id:'video-publication',label:'공개·대표 설정'}]:[])]}><main id="admin-content" tabIndex={-1} className={styles.page}>
  <header className={styles.header}><div><span className={styles.eyebrow}>WORSHIP & WORD</span><h1>예배 영상 관리</h1></div><InfoTip label="예배 영상"><p>채널에서 영상 링크를 복사해 등록합니다. 제목이나 썸네일만으로 예배 종류를 자동 확정하지 않습니다.</p><p>예배별 대표 영상은 하나입니다. 대표를 지정하지 않으면 가장 최근 날짜의 공개 영상이 먼저 나옵니다. 보관한 영상은 목록에서 내려갑니다.</p><p>현재 입력을 공개하려면 공개 저장을 누릅니다. 초안 저장은 공개하지 않습니다.</p></InfoTip></header>
  {message?<p role="status" className={styles.message}>{message}</p>:null}
  {!allowed?<><Link href="/admin/bulletins" target="_blank">새 탭에서 관리자 로그인</Link><button onClick={()=>setReload(n=>n+1)}>로그인 다시 확인</button></>:<>
   <section id="video-library" tabIndex={-1} className={`${styles.card} ${styles.slimCard}`}><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>{if(!mayLeave())return;setEntry({id:crypto.randomUUID(),service_type:'sunday',service_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),video_id:'',title:'',status:'draft',featured:false,revision:0});setLink('');setDirty(true);setMessage('');}}>새 영상 등록</button><a href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer">교회 YouTube에서 찾기</a><button disabled={busy} onClick={()=>{if(mayLeave()){setEntry(null);setDirty(false);setReload(n=>n+1);}}}>목록 새로 불러오기</button></div>
   <ul className={styles.videoAdminList}>{rows.map(row=><li key={row.id}><button disabled={busy} aria-pressed={entry?.id===row.id} onClick={()=>{if(mayLeave()){setEntry({...row});setLink(`https://www.youtube.com/watch?v=${row.video_id}`);setDirty(false);setMessage('');}}}><span>{row.service_date} · {worshipTypes.find(w=>w.key===row.service_type)?.name}</span><strong>{row.title}</strong><small>{row.status==='published'?'공개':row.status==='archived'?'보관':'초안'}{row.featured?' · 대표':''}</small></button></li>)}</ul>{!rows.length?<p className={styles.muted}>등록된 영상이 없습니다.</p>:null}{more?<button disabled={busy} onClick={()=>void loadMore()}>이전 등록 영상 더 보기</button>:null}</section>
   {entry?<fieldset disabled={busy} className={styles.fields}><section id="video-details" tabIndex={-1} className={styles.flatSection}><h2>예배·영상 정보</h2><p className={styles.muted}>{dirty?'수정 중':'저장됨'} · {entry.status==='published'?'공개 중':entry.status==='archived'?'보관':'초안'}</p><label>예배 종류<select value={entry.service_type} onChange={e=>change({service_type:e.target.value})}>{worshipTypes.map(w=><option key={w.key} value={w.key}>{w.name}</option>)}</select></label><label>예배 날짜<input type="date" min="1900-01-01" max="2199-12-31" value={entry.service_date} onChange={e=>change({service_date:e.target.value})}/></label><label>YouTube 영상 링크<input type="text" maxLength={2048} value={link} placeholder="https://www.youtube.com/watch?v=…" onChange={e=>{setLink(e.target.value);setDirty(true);setMessage('');}}/></label><label>영상 제목<input maxLength={200} value={entry.title} onChange={e=>change({title:e.target.value})}/></label></section>
    <section id="video-preview" tabIndex={-1} className={styles.flatSection}><h2>영상 확인</h2>{id?<><iframe className={styles.videoPreview} title="등록할 예배 영상 확인" src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} allowFullScreen/><a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">YouTube에서 확인</a></>:<p className={styles.muted}>영상 링크를 입력하면 여기에서 확인할 수 있습니다.</p>}</section>
    <section id="video-publication" tabIndex={-1} className={styles.flatSection}><h2>공개·대표 설정</h2><label className={styles.check}><input type="checkbox" checked={entry.featured} onChange={e=>change({featured:e.target.checked})}/>이 예배의 대표 영상으로 지정</label><div className={styles.actions}><button onClick={()=>void save('draft')}>{entry.status==='published'?'공개 취소하고 초안 저장':'초안 저장'}</button><button className={styles.primary} onClick={()=>void save('published')}>공개 저장</button><button disabled={entry.revision===0} onClick={()=>void save('archived')}>보관</button></div></section>
   </fieldset>:null}
  </>}
 </main></AdminShell>;
}
