"use client";
import { useEffect,useState } from "react";
import { koreanInput, type CommunityEntry } from "@/lib/community";
import styles from "./admin/bulletins/workspace.module.css";
type PublicEntry=Pick<CommunityEntry,"id"|"title"|"body"|"starts_at"|"ends_at"|"location">;
export default function CommunityReader({kind}:{kind:"notice"|"event"}){
  const [rows,setRows]=useState<PublicEntry[]>([]),[message,setMessage]=useState("불러오고 있습니다…"),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let sequence=0;
    async function refresh(){const current=++sequence;try{const response=await fetch(`/api/community?kind=${kind}`,{cache:"no-store",signal:controller.signal});const data=await response.json();if(controller.signal.aborted||current!==sequence)return;if(!response.ok)throw new Error(data.error);setRows(data.entries);setMessage(data.entries.length?"":"현재 공개된 내용이 없습니다.");}catch(error){if(controller.signal.aborted||current!==sequence)return;setRows([]);setMessage(error instanceof Error?error.message:"불러오지 못했습니다.");}}
    void refresh();const timer=window.setInterval(refresh,15000);window.addEventListener("focus",refresh);
    return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[kind,retry]);
  return <main id="public-content" className={styles.page}><h1>{kind==="notice"?"교회 공지":"교회 일정"}</h1><p role="status">{message}</p><button onClick={()=>setRetry(value=>value+1)}>다시 불러오기</button>{rows.map(row=><article className={styles.card} key={row.id}><h2>{row.title}</h2>{kind==="event"?<><p>{koreanInput(row.starts_at).replace("T"," ")}{row.ends_at?` ~ ${koreanInput(row.ends_at).replace("T"," ")}`:""} (한국 시간)</p><p>{row.location}</p></>:null}<p style={{whiteSpace:"pre-wrap"}}>{row.body}</p></article>)}</main>;
}
