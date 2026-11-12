"use client";
import { useEffect,useState } from "react";
import { koreanInput, type CommunityEntry } from "@/lib/community";
import styles from "./public-content.module.css";
import EventCalendar from "./event-calendar";
type PublicEntry=Pick<CommunityEntry,"id"|"title"|"body"|"starts_at"|"ends_at"|"location">;
export default function CommunityReader({kind}:{kind:"notice"|"event"}){
  const [rows,setRows]=useState<PublicEntry[]>([]),[message,setMessage]=useState("불러오고 있습니다…"),[retry,setRetry]=useState(0);
  const [failed, setFailed] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<string | null>(null);
  useEffect(()=>{
    const controller=new AbortController();let sequence=0;
    async function refresh(){const current=++sequence;try{const response=await fetch(`/api/community?kind=${kind}${calendarMonth ? `&month=${calendarMonth}` : ""}`,{cache:"no-store",signal:controller.signal});const data=await response.json();if(controller.signal.aborted||current!==sequence)return;if(!response.ok)throw new Error(data.error);setRows(data.entries);setFailed(false);setMessage(data.truncated?"일정이 많아 처음 100개를 표시합니다.":data.entries.length?"":"현재 공개된 내용이 없습니다.");}catch{if(controller.signal.aborted||current!==sequence)return;setRows([]);setFailed(true);setMessage("소식을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");}}
    void refresh();const timer=window.setInterval(refresh,15000);window.addEventListener("focus",refresh);
    return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[kind,retry,calendarMonth]);
  return <main id="public-content" className={styles.page}>
    <header className={styles.heading}><p>함께 나누는 교회 소식</p><h1>{kind === "notice" ? "교회 공지" : "교회 일정"}</h1><p>{kind === "notice" ? "함께 알아두면 좋은 소식을 전합니다." : "예배와 모임의 시간, 장소를 확인하세요."}</p></header>
    {message ? <div className={styles.state}><p role="status">{message}</p>{failed ? <button onClick={() => { setMessage("불러오고 있습니다…"); setFailed(false); setRetry(value => value + 1); }}>다시 불러오기</button> : null}</div> : null}
    {kind === "event" ? <EventCalendar events={rows} onMonthChange={month => { if (month !== calendarMonth) { setRows([]); setMessage("불러오고 있습니다…"); setCalendarMonth(month); } }}>{ids => renderRows(ids ? rows.filter(row => ids.has(row.id)) : rows)}</EventCalendar> : renderRows(rows)}
  </main>;
  function renderRows(entries: PublicEntry[]) { return <div className={styles.list}>{entries.map(row => <article className={styles.card} key={row.id}><h2>{row.title}</h2>
      {kind === "event" ? <dl className={styles.meta}><dt>일시</dt><dd>{row.starts_at ? <>{koreanInput(row.starts_at).replace("T", " ")}{row.ends_at ? ` ~ ${koreanInput(row.ends_at).replace("T", " ")}` : ""} (한국 시간)</> : "시간 안내를 준비 중입니다."}</dd><dt>장소</dt><dd>{row.location?.trim() || "장소 안내를 준비 중입니다."}</dd></dl> : null}
      <p className={styles.body}>{row.body}</p></article>)}</div>; }
}
