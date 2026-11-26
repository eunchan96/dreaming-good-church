"use client";
import { useEffect,useState } from "react";
import { koreanInput, type CommunityEntry } from "@/lib/community";
import styles from "./public-content.module.css";
import EventCalendar from "./event-calendar";
import SiteIcon from "./site-icon";
import { Skel, SkelLines, SkelRegion } from "./skeleton";
import { eventWhen, koreaDate } from "@/lib/korean-date";
import NewsNavigation from './news-navigation';
import site from './public-site.module.css';
type PublicEntry=Pick<CommunityEntry,"id"|"title"|"body"|"starts_at"|"ends_at"|"location"|"publish_from">&{updated_at?:string};
/** 공지에 보이는 날짜: 게시 시작일을 정했으면 그 날, 아니면 마지막으로 고친 날. */
const postedAt=(row:PublicEntry)=>row.publish_from??row.updated_at??null;
export default function CommunityReader({kind}:{kind:"notice"|"event"}){
  const LOADING="불러오고 있습니다…";
  const [rows,setRows]=useState<PublicEntry[]>([]),[message,setMessage]=useState(LOADING),[retry,setRetry]=useState(0);
  const [failed, setFailed] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<string | null>(null);
  useEffect(()=>{
    const controller=new AbortController();let sequence=0;
    async function refresh(){if(kind==="event"&&!calendarMonth)return;const current=++sequence;try{const response=await fetch(`/api/community?kind=${kind}${calendarMonth ? `&month=${calendarMonth}` : ""}`,{cache:"no-store",signal:controller.signal});const data=await response.json();if(controller.signal.aborted||current!==sequence)return;if(!response.ok)throw new Error(data.error);setRows(data.entries);setFailed(false);setMessage(data.truncated?"일정이 많아 처음 100개를 표시합니다.":data.entries.length||kind==="event"?"":"현재 공개된 내용이 없습니다.");}catch{if(controller.signal.aborted||current!==sequence)return;setRows([]);setFailed(true);setMessage("소식을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");}}
    void refresh();const timer=window.setInterval(refresh,15000);window.addEventListener("focus",refresh);
    return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[kind,retry,calendarMonth]);
  return <main id="public-content" tabIndex={-1} className={site.subpage}>
    <header className={site.pageHeading}><p className={site.eyebrow}>LIFE TOGETHER</p><h1>{kind === "notice" ? "교회 소식" : "교회 일정"}</h1><p>{kind === "notice" ? "함께 알아두면 좋은 소식을 전합니다." : "예배와 모임의 시간, 장소를 확인하세요."}</p></header><NewsNavigation />
    <div className={site.newsBody}>
    {message && message !== LOADING ? <div className={styles.state}><p role="status">{message}</p>{failed ? <button onClick={() => { setMessage(LOADING); setFailed(false); setRetry(value => value + 1); }}>다시 불러오기</button> : null}</div> : null}
    {kind === "event" ? <EventCalendar loading={message === LOADING} events={rows} onMonthChange={month => { if (month !== calendarMonth) { setRows([]); setMessage(LOADING); setCalendarMonth(month); } }}>{ids => renderRows(ids ? rows.filter(row => ids.has(row.id)) : rows)}</EventCalendar> : renderRows(rows)}
    </div>
  </main>;
  function placeholder() { return <SkelRegion className={styles.list}>{[0, 1, 2].map(i => <div className={styles.card} key={i}><Skel w={i === 1 ? "46%" : "58%"} h={22} style={{ gridArea: "title", marginBottom: 14 }} /><span style={{ gridArea: "body" }}><SkelLines n={2} h={14} /></span></div>)}</SkelRegion>; }
  function renderRows(entries: PublicEntry[]) { if (message === LOADING && !entries.length) return placeholder(); return <div className={styles.list}>{entries.map(row => <article className={styles.card} key={row.id}>{kind === "notice" && postedAt(row) ? <time className={styles.date} dateTime={postedAt(row)!}>{koreaDate(postedAt(row)!)}</time> : null}<h2>{row.title}</h2>
      {kind === "event" ? <dl className={styles.meta}><div><dt><SiteIcon name="clock" size={16}/><span>일시</span></dt><dd>{row.starts_at ? eventWhen(koreanInput(row.starts_at), row.ends_at ? koreanInput(row.ends_at) : null) : "시간 안내를 준비 중입니다."}</dd></div><div><dt><SiteIcon name="pin" size={16}/><span>장소</span></dt><dd>{row.location?.trim() || "장소 안내를 준비 중입니다."}</dd></div></dl> : null}
      <p className={styles.body}>{row.body}</p></article>)}</div>; }
}
