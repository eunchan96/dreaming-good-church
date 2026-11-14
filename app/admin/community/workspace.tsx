"use client";

import { useEffect, useRef, useState } from "react";
import { makeBrowserClient } from "@/lib/bulletin-store";
import { communityFromRow, communityError, newEntry, koreanInput, fromKoreanInput, type CommunityEntry } from "@/lib/community";
import styles from "../bulletins/workspace.module.css";
import AdminShell from '../admin-shell';
import ReauthPanel from '../reauth-panel';
import Link from 'next/link';
import ui from './workspace.module.css';

export default function CommunityWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<CommunityEntry[]>([]);
  const [entry, setEntry] = useState<CommunityEntry | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("로그인을 확인하고 있습니다…");
  const [reload, setReload] = useState(0);
  const [filter,setFilter]=useState<'all'|'notice'|'event'>('all'),[query,setQuery]=useState('');
  const [loading,setLoading]=useState(true),[listError,setListError]=useState(false),[now,setNow]=useState(0);
  const owner = useRef<string | null>(null);
  useEffect(() => {
    if (!client) return;
    let active = true;
    async function load() {
      try {
        const { data, error } = await client!.auth.getUser();
        if (error || !data.user) throw new Error("login");
        const member = await client!.from("church_editors").select("user_id").eq("user_id",data.user.id).maybeSingle();
        if (member.error || !member.data) throw new Error("membership");
        if(!active)return;
        if(owner.current && owner.current!==data.user.id){setEntry(null);setDirty(false);setQuery('');setFilter('all');}
        owner.current=data.user.id;setAllowed(true);setLoading(true);setListError(false);setMessage('');
        const list = await client!.from("community_entries").select("*").order("updated_at",{ascending:false}).limit(100);
        if(!active)return;
        if(list.error){setRows([]);setListError(true);setLoading(false);return;}
        setRows(list.data.map(communityFromRow));setNow(Date.now());setLoading(false);setMessage("");
      } catch { if (active) { setAllowed(false); setMessage("관리자 로그인이 필요합니다. 새 탭에서 로그인한 후 ‘로그인 다시 확인’을 눌러 주세요. 미저장 내용은 현재 탭에 유지됩니다."); } }
    }
    void load();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) { setAllowed(false); setRows([]); setMessage("로그인이 종료되었습니다. 작성 내용은 현재 탭에 유지됩니다. 새 탭에서 같은 계정으로 로그인해 주세요."); }
      if (event === "SIGNED_IN" && active) setReload(value=>value+1);
    });
    return () => { active=false; subscription.unsubscribe(); };
  },[client,reload]);
  useEffect(()=>{const tick=()=>setNow(Date.now());const timer=setInterval(tick,30000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);};},[]);
  useEffect(()=>{if(!allowed||!['저장했습니다. 기존 주보의 내용은 변경되지 않습니다.','보관했습니다. 공개 메뉴에서 제외되며 주보의 복사본은 유지됩니다.'].includes(message))return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),3500);return()=>clearTimeout(timer);},[allowed,message]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue=""; };
    window.addEventListener("beforeunload",guard); return () => window.removeEventListener("beforeunload",guard);
  },[dirty]);
  const mayLeave = () => !dirty || window.confirm("저장하지 않은 변경 내용을 버릴까요?");
  async function logout() {
    if (!client || busy || !mayLeave()) return;
    setBusy(true);
    try { const { error } = await client.auth.signOut({ scope:'local' }); if (error) throw error; }
    catch { setMessage('로그아웃 요청을 확인하지 못했습니다. 로그인 상태를 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  function change(values: Partial<CommunityEntry>) { setEntry((current) => current && ({...current,...values})); setDirty(true);setMessage(''); }
  async function save(status: CommunityEntry["status"]) {
    if (!client || !entry || busy || loading) return;
    if (!entry.title.trim() || (entry.kind==="event" && !entry.starts_at) || (status==="published" && entry.kind==="notice" && !entry.body.trim())) { setMessage("제목과 필수 내용·일정 시작 시간을 입력해 주세요."); return; }
    if (entry.kind === "event" && entry.starts_at && entry.ends_at && Date.parse(entry.ends_at) <= Date.parse(entry.starts_at)) { setMessage("종료 시간은 시작 시간보다 늦게 입력해 주세요. 작성 내용은 유지됩니다."); return; }
    if (entry.publish_from && entry.publish_until && Date.parse(entry.publish_until) <= Date.parse(entry.publish_from)) { setMessage("게시 기간 종료는 게시 기간 시작보다 늦게 입력해 주세요. 작성 내용은 유지됩니다."); return; }
    if (status==="published" && !window.confirm("설정한 공개 여부와 게시 기간으로 저장할까요? 기간에 해당하면 바로 공개됩니다.")) return;
    setBusy(true); setMessage("");
    try {
      const {data,error}=await client.rpc("save_community_entry",{p_id:entry.id,p_revision:entry.revision,p_entry:{...entry,status}});
      if (error) throw error;
      setEntry(communityFromRow(data)); setDirty(false); setRows((current)=>[communityFromRow(data),...current.filter(row=>row.id!==data.id)]);
      setMessage(status==="archived" ? "보관했습니다. 공개 메뉴에서 제외되며 주보의 복사본은 유지됩니다." : "저장했습니다. 기존 주보의 내용은 변경되지 않습니다.");
    } catch(error) { setMessage(communityError(error)); if((error as {code?:string;status?:number}).status===401)setAllowed(false); }
    finally { setBusy(false); }
  }
  function statusLabel(row:CommunityEntry){if(row.status==='draft')return '초안';if(row.status==='archived')return '보관';if(row.sensitive||!row.is_public)return '비공개';if(row.publish_from&&Date.parse(row.publish_from)>now)return '공개 예정';if(row.publish_until&&Date.parse(row.publish_until)<=now)return '게시 종료';return '공개';}
  const filtered=rows.filter(row=>(filter==='all'||row.kind===filter)&&row.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const intro=<header className={ui.intro}><span className={styles.eyebrow}>CHURCH COMMUNITY</span><h1 id="community-heading">공지·일정 관리</h1><p>주보의 공지와 모임 일정을 관리합니다. 변경해도 기존 주보는 바뀌지 않습니다.</p></header>;
  const sections=[{id:'community-list',label:'소식 목록'},...(entry?[{id:'community-editor',label:'내용 편집'},...(entry.kind==='event'?[{id:'community-schedule',label:'일정 시간'}]:[]),{id:'community-publication',label:'공개 설정'}]:[])];
  return <AdminShell active="community" intro={intro} authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} sections={sections}><main id="admin-content" aria-labelledby="community-heading" tabIndex={-1} className={`${styles.page} ${ui.editor}`}>
    {allowed ? <>
      <section id="community-list" tabIndex={-1} aria-label="소식 목록" className={ui.section}><div className={ui.sectionHeading}><h2>소식 목록</h2><div className={ui.listActions}><button disabled={busy||loading} onClick={()=>{if(mayLeave()){setEntry(newEntry('event'));setDirty(true);setMessage('');setFilter('all');setQuery('');}}}>새 일정</button><button className={ui.refresh} disabled={busy||loading} onClick={()=>{if(mayLeave()){setEntry(null);setDirty(false);setReload(value=>value+1);}}}>목록 새로 불러오기</button></div></div>
      <div className={ui.listTools}><div className={ui.filters} role="group" aria-label="소식 종류">{([['all','전체'],['notice','공지'],['event','일정']] as const).map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div><input type="search" aria-label="소식 제목 검색" placeholder="제목 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      {loading?<p role="status" className={ui.empty}>목록을 불러오고 있습니다.</p>:listError?<div className={ui.empty}><p role="status">목록을 불러오지 못했습니다. 작성 중인 내용은 유지됩니다.</p><button onClick={()=>setReload(n=>n+1)}>목록 다시 불러오기</button></div>:<><ul className={ui.entries}>{filtered.map(row=><li key={row.id}><button disabled={busy} aria-pressed={entry?.id===row.id} onClick={()=>{if(mayLeave()){setEntry(structuredClone(row));setDirty(false);setMessage('');}}}><div><strong>{row.title}</strong><span>{row.kind==='event'?'일정':'공지'}{row.kind==='event'&&row.starts_at?` · ${koreanInput(row.starts_at).replace('T',' ')}`:row.publish_from?` · ${koreanInput(row.publish_from).replace('T',' ')}부터`:''}</span></div><span className={ui.badge} data-state={statusLabel(row)}>{statusLabel(row)}</span></button></li>)}</ul>{!filtered.length?<p className={ui.empty}>{rows.length?'검색 조건에 맞는 소식이 없습니다.':'등록된 소식이 없습니다.'}</p>:null}</>}
      <div className={ui.listNote}><Link href="/admin/bulletins" onClick={e=>{if(busy||!mayLeave())e.preventDefault();}}>주보에서 공지 가져오기</Link>{rows.length===100?<span>최근 100개에서 찾습니다.</span>:null}</div>
      </section>
      {entry?<fieldset disabled={busy||loading} className={styles.fields}>
        <section id="community-editor" tabIndex={-1} aria-label="내용 편집" className={ui.section}><div className={ui.sectionHeading}><h2>{entry.kind==='event'?'일정 편집':'공지 편집'}</h2><span className={ui.editStatus}>{busy?'저장 중…':dirty?'수정 중':'최신 버전'}</span></div>
        <div className={ui.fieldRow}><label htmlFor="community-title">제목</label><div className={ui.counted}><input id="community-title" maxLength={200} placeholder="제목" value={entry.title} onChange={e=>change({title:e.target.value})}/><span aria-hidden="true">{entry.title.length}/200</span></div></div>
        <div className={ui.fieldRow}><label htmlFor="community-body">내용</label><div><textarea id="community-body" rows={6} maxLength={entry.kind==='event'?19000:20000} placeholder="내용" value={entry.body} onChange={e=>change({body:e.target.value})}/><span className={ui.textCount} aria-hidden="true">{entry.body.length}/{entry.kind==='event'?19000:20000}</span></div></div>
        </section>
        {entry.kind==='event'?<section id="community-schedule" tabIndex={-1} aria-label="일정 시간" className={ui.section}><div className={ui.sectionHeading}><h2>일정 시간</h2><span className={ui.editStatus}>한국 시간</span></div>
        <div className={ui.fieldRow}><label htmlFor="community-start">시작 시간</label><input id="community-start" type="datetime-local" value={koreanInput(entry.starts_at)} onChange={e=>change({starts_at:fromKoreanInput(e.target.value)})}/></div>
        <div className={ui.fieldRow}><label htmlFor="community-end">종료 시간</label><input id="community-end" type="datetime-local" value={koreanInput(entry.ends_at)} onChange={e=>change({ends_at:fromKoreanInput(e.target.value)})}/></div>
        <div className={ui.fieldRow}><label htmlFor="community-location">장소</label><input id="community-location" maxLength={500} placeholder="장소" value={entry.location} onChange={e=>change({location:e.target.value})}/></div></section>:null}
        <section id="community-publication" tabIndex={-1} aria-label="공개 설정" className={ui.section}><div className={ui.sectionHeading}><h2>공개 설정</h2><span className={ui.badge} data-state={statusLabel(entry)}>{statusLabel(entry)}</span></div>
        <div className={ui.visibility}><label className={styles.check}><input type="checkbox" checked={entry.is_public} disabled={entry.sensitive} onChange={e=>change({is_public:e.target.checked})}/>별도 메뉴에 공개</label><label className={styles.check}><input type="checkbox" checked={entry.sensitive} onChange={e=>change({sensitive:e.target.checked,...(e.target.checked?{is_public:false}:{})})}/>민감정보 포함</label></div>
        {entry.sensitive?<p className={ui.hint}>민감정보가 포함되면 별도 메뉴에 공개되지 않습니다.</p>:null}
        <details key={'period-'+entry.id} open={!!(entry.publish_from||entry.publish_until)} className={ui.period}><summary>게시 기간</summary><p className={ui.hint}>미지정 시 기간 제한 없음 · 한국 시간</p><div className={ui.fieldRow}><label htmlFor="community-from">게시 기간 시작</label><input id="community-from" type="datetime-local" value={koreanInput(entry.publish_from)} onChange={e=>change({publish_from:fromKoreanInput(e.target.value)})}/></div><div className={ui.fieldRow}><label htmlFor="community-until">게시 기간 종료</label><input id="community-until" type="datetime-local" value={koreanInput(entry.publish_until)} onChange={e=>change({publish_until:fromKoreanInput(e.target.value)})}/></div></details>
        <div className={ui.saveActions}><button disabled={!dirty&&entry.status==='draft'} onClick={()=>void save('draft')}>{entry.status==='published'?'게시 취소하고 초안 저장':'초안 저장'}</button><button className={styles.primary} disabled={!dirty&&entry.status==='published'} onClick={()=>void save('published')}>게시 설정 저장</button></div>
        {message?<p role="status" className={ui.feedback}>{message}</p>:null}
        <details key={'more-'+entry.id} className={ui.more}><summary>추가 작업</summary><div className={ui.extraActions}><button onClick={()=>{if(mayLeave()){const copy={...structuredClone(entry),id:crypto.randomUUID(),status:'draft' as const,revision:0};if(entry.kind==='event'){copy.starts_at=entry.starts_at?new Date(Date.parse(entry.starts_at)+7*86400000).toISOString():null;copy.ends_at=entry.ends_at?new Date(Date.parse(entry.ends_at)+7*86400000).toISOString():null;}copy.publish_from=null;copy.publish_until=null;setEntry(copy);setDirty(true);setMessage('복사본을 만들었습니다. 날짜와 게시 기간을 확인한 뒤 저장해 주세요.');}}}>{entry.kind==='event'?'다음 주 일정으로 복사':'새 공지 초안으로 복사'}</button><button disabled={entry.revision===0||(!dirty&&entry.status==='archived')} onClick={()=>{if(window.confirm('보관하고 별도 메뉴에서 내릴까요? 기존 주보는 유지됩니다.'))void save('archived');}}>보관</button></div></details>
        </section>
      </fieldset>:<p className={ui.empty}>목록에서 공지나 일정을 선택해 주세요.</p>}
      {!entry&&message?<p role="status" className={ui.feedback}>{message}</p>:null}
    </>:<ReauthPanel message={message} hasDraft={dirty} onRetry={()=>{setMessage('로그인 상태를 확인하고 있습니다…');setReload(value=>value+1);}}/>}
  </main></AdminShell>;
}
