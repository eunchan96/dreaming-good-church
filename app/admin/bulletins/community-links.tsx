"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadBulletins, makeBrowserClient, type SavedBulletin } from "@/lib/bulletin-store";
import { communityError, type CommunityEntry } from "@/lib/community";
import styles from "./workspace.module.css";

export default function CommunityLinks({ draft, locked, onBusy, onImported }: { draft: SavedBulletin; locked: boolean; onBusy: (busy: boolean)=>void; onImported:(draft:SavedBulletin)=>void }) {
  const [client]=useState(makeBrowserClient);
  const [entries,setEntries]=useState<CommunityEntry[]>([]);
  const [entryId,setEntryId]=useState("");
  const [itemId,setItemId]=useState("");
  const [message,setMessage]=useState("");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(!client)return;
    let active=true;
    void client.from("community_entries").select("*").neq("status","archived").order("updated_at",{ascending:false}).limit(100).then(({data,error})=>{if(active){if(error)setMessage(communityError(error));else setEntries(data);}});
    return ()=>{active=false;};
  },[client,refresh]);
  const items=draft.items.filter(item=>!item.kind||item.kind==="text");
  const selectedItem=items.some(item=>item.id===itemId)?itemId:items[0]?.id;
  const selectedEntry=entries.some(entry=>entry.id===entryId)?entryId:entries[0]?.id;
  async function perform(importing:boolean){
    if(!client||locked)return;
    onBusy(true);setMessage("");
    try{
      const {error}=importing?await client.rpc("copy_community_to_bulletin",{p_entry:selectedEntry,p_bulletin:draft.id,p_revision:draft.revision}):await client.rpc("create_notice_from_bulletin",{p_bulletin:draft.id,p_item:selectedItem,p_revision:draft.revision});
      if(error)throw error;
      if(importing){const row=(await loadBulletins(client)).find(row=>row.id===draft.id);if(row)onImported(row);setMessage("현재 내용과 공개 설정을 주보에 복사했습니다. 이번 주 확인 후 게시해 주세요.");}
      else {setRefresh(value=>value+1);setMessage("연결된 공지 초안을 준비했습니다. 공지·일정 관리에서 내용을 확인하고 게시해 주세요. 이미 연결된 공지는 중복 생성하거나 덮어쓰지 않습니다.");}
    }catch(error){setMessage(communityError(error));}finally{onBusy(false);}
  }
  return <section className={styles.card}><h3>공지·일정 연결</h3><p><Link href="/admin/community" target="_blank">공지·일정 관리 열기</Link></p>
    <p>복사 시점의 내용을 보관합니다. 이후 원본을 수정하거나 비공개로 바꿔도 이 주보는 바뀌지 않습니다.</p>
    <p aria-live="polite">{message}</p>
    <label>별도 공지로 가져올 항목<select value={selectedItem??""} disabled={locked} onChange={event=>setItemId(event.target.value)}>{items.map(item=><option key={item.id} value={item.id}>{item.title}{item.webVisible?"":" (웹 비공개)"}</option>)}</select></label>
    <button disabled={locked||!selectedItem||draft.revision===0} onClick={()=>perform(false)}>별도 공지로 가져오기</button>
    <label>주보에 넣을 공지·일정<select value={selectedEntry??""} disabled={locked} onChange={event=>setEntryId(event.target.value)}>{entries.map(entry=><option key={entry.id} value={entry.id}>{entry.title} · {entry.kind==="event"?"일정":"공지"}{entry.is_public?"":" (비공개)"}</option>)}</select></label>
    <button disabled={locked} onClick={()=>setRefresh(value=>value+1)}>공지·일정 목록 새로고침</button>
    <button disabled={locked||!selectedEntry||draft.revision===0||draft.status!=="draft"} onClick={()=>perform(true)}>선택한 내용을 주보에 복사</button>
    {locked||draft.revision===0?<p>주보 저장이 끝난 뒤 사용할 수 있습니다.</p>:null}
  </section>;
}
