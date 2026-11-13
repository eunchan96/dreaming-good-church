"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { makeBrowserClient } from "@/lib/bulletin-store";
import { communityFromRow, communityError, newEntry, koreanInput, fromKoreanInput, type CommunityEntry } from "@/lib/community";
import styles from "../bulletins/workspace.module.css";

export default function CommunityWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<CommunityEntry[]>([]);
  const [entry, setEntry] = useState<CommunityEntry | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("로그인을 확인하고 있습니다…");
  const [reload, setReload] = useState(0);
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
        const list = await client!.from("community_entries").select("*").order("updated_at",{ascending:false}).limit(100);
        if (list.error) throw list.error;
        if (active) { if(owner.current && owner.current!==data.user.id){setEntry(null);setDirty(false);}owner.current=data.user.id;setAllowed(true); setRows(list.data.map(communityFromRow)); setMessage(""); }
      } catch { if (active) { setAllowed(false); setMessage("관리자 로그인이 필요합니다. 새 탭에서 로그인한 후 ‘로그인 다시 확인’을 눌러 주세요. 미저장 내용은 현재 탭에 유지됩니다."); } }
    }
    void load();
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) { setAllowed(false); setRows([]); setMessage("로그인이 종료되었습니다. 작성 내용은 현재 탭에 유지됩니다. 새 탭에서 같은 계정으로 로그인해 주세요."); }
      if (event === "SIGNED_IN" && active) setReload(value=>value+1);
    });
    return () => { active=false; subscription.unsubscribe(); };
  },[client,reload]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue=""; };
    window.addEventListener("beforeunload",guard); return () => window.removeEventListener("beforeunload",guard);
  },[dirty]);
  const mayLeave = () => !dirty || window.confirm("저장하지 않은 변경 내용을 버릴까요?");
  function change(values: Partial<CommunityEntry>) { setEntry((current) => current && ({...current,...values})); setDirty(true); }
  async function save(status: CommunityEntry["status"]) {
    if (!client || !entry || busy) return;
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
  return <main className={styles.page}><header><h1>공지·일정 관리</h1><p><Link href="/admin/bulletins" onClick={event=>{if(!mayLeave())event.preventDefault();}}>주보 관리로 돌아가기</Link> · <Link href="/notices" target="_blank">공개 공지</Link> · <Link href="/events" target="_blank">공개 일정</Link></p></header><p role="status" className={styles.message}>{message}</p>
    {allowed ? <div className={styles.grid}><aside className={styles.card}>
      <button disabled={busy} onClick={()=>{if(mayLeave()){setEntry(newEntry("event"));setDirty(true);setMessage("");}}}>새 일정</button>
      <p>공지는 주보의 ‘별도 공지로 가져오기’를 이용해 주세요.</p>
      <button disabled={busy} onClick={()=>{if(mayLeave()){setEntry(null);setDirty(false);setReload(value=>value+1);}}}>목록 새로 불러오기</button>
      <ul className={styles.list}>{rows.map(row=><li key={row.id}><button disabled={busy} onClick={()=>{if(mayLeave()){setEntry(structuredClone(row));setDirty(false);setMessage("");}}}>{row.title} · {row.kind==="event"?"일정":"공지"} · {row.status==="published"?"게시 설정됨":row.status==="archived"?"보관":"초안"}</button></li>)}</ul>
    </aside><section>{entry ? <fieldset disabled={busy} className={styles.fields}><div className={styles.card}>
      <h2>{entry.kind==="event"?"일정 편집":"공지 편집"}</h2><p>{busy?"저장 중…":dirty?"저장 전 변경 있음":"저장됨"} · 모든 시간은 한국 시간(Asia/Seoul)입니다.</p>
      <label htmlFor="community-title">제목</label><input id="community-title" maxLength={200} value={entry.title} onChange={event=>change({title:event.target.value})}/>
      <label htmlFor="community-body">내용</label><textarea id="community-body" rows={6} maxLength={entry.kind==="event"?19000:20000} value={entry.body} onChange={event=>change({body:event.target.value})}/>
      {entry.kind==="event" ? <><label>시작 시간<input type="datetime-local" value={koreanInput(entry.starts_at)} onChange={event=>change({starts_at:fromKoreanInput(event.target.value)})}/></label><label>종료 시간<input type="datetime-local" value={koreanInput(entry.ends_at)} onChange={event=>change({ends_at:fromKoreanInput(event.target.value)})}/></label><label>장소<input maxLength={500} value={entry.location} onChange={event=>change({location:event.target.value})}/></label></> : null}
      <label className={styles.check}><input type="checkbox" checked={entry.sensitive} onChange={event=>change({sensitive:event.target.checked,...(event.target.checked?{is_public:false}:{})})}/>민감정보 포함</label>
      <label className={styles.check}><input type="checkbox" checked={entry.is_public} disabled={entry.sensitive} onChange={event=>change({is_public:event.target.checked})}/>별도 메뉴에 공개</label>
      <label>게시 기간 시작<input type="datetime-local" value={koreanInput(entry.publish_from)} onChange={event=>change({publish_from:fromKoreanInput(event.target.value)})}/></label>
      <label>게시 기간 종료<input type="datetime-local" value={koreanInput(entry.publish_until)} onChange={event=>change({publish_until:fromKoreanInput(event.target.value)})}/></label>
      <p>게시 기간을 비우면 제한이 없습니다. 민감정보 표시는 별도 메뉴의 공개를 막으며, 기존 주보 복사본의 공개 설정은 별도로 확인해야 합니다.</p>
      <div className={`${styles.actions} ${styles.formActions}`}><button onClick={()=>save("draft")}>{entry.status==="published"?"게시 취소하고 초안 저장":"초안 저장"}</button><button onClick={()=>save("published")}>게시 설정 저장</button><button disabled={entry.revision===0} onClick={()=>{if(window.confirm("보관하고 별도 메뉴에서 내릴까요? 기존 주보는 유지됩니다."))void save("archived");}}>보관</button>
      <button onClick={()=>{if(mayLeave()){const copy={...structuredClone(entry),id:crypto.randomUUID(),status:"draft" as const,revision:0};if(entry.kind==="event"){copy.starts_at=entry.starts_at?new Date(Date.parse(entry.starts_at)+7*86400000).toISOString():null;copy.ends_at=entry.ends_at?new Date(Date.parse(entry.ends_at)+7*86400000).toISOString():null;}copy.publish_from=null;copy.publish_until=null;setEntry(copy);setDirty(true);setMessage("복사본을 만들었습니다. 날짜와 게시 기간을 확인한 뒤 저장해 주세요.");}}}>{entry.kind==="event"?"다음 주 일정으로 복사":"새 공지 초안으로 복사"}</button></div>
    </div></fieldset> : <p>공지나 일정을 선택해 주세요.</p>}</section></div> : <><Link href="/admin/bulletins" target="_blank">새 탭에서 관리자 로그인</Link><button onClick={()=>setReload(value=>value+1)}>로그인 다시 확인</button></>}
  </main>;
}
