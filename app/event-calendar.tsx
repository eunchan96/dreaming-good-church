"use client";
import { useEffect, useState } from "react";
import { koreanInput } from "@/lib/community";
import { monthDayWeek } from "@/lib/korean-date";
import styles from "./public-content.module.css";
import SiteIcon from "./site-icon";

type Event = { id: string; starts_at: string | null; ends_at: string | null };
export default function EventCalendar({ events, children, onMonthChange }: { events: Event[]; children: (ids: Set<string> | null) => React.ReactNode; onMonthChange: (month: string | null) => void }) {
  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const currentMonth = () => koreanInput(new Date().toISOString()).slice(0, 7);
  // 시계는 화면이 열린 뒤에만 읽는다(미리 그리는 중에는 읽지 않음).
  useEffect(() => { const first = currentMonth(); setMonth(first); onMonthChange(first); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const today = month ? koreanInput(new Date().toISOString()).slice(0, 10) : "";
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5));
  const days = month ? new Date(Date.UTC(year, number, 0)).getUTCDate() : 0;
  const offset = month ? new Date(`${month}-01T00:00:00Z`).getUTCDay() : 0;
  function onDay(event: Event, day: string) {
    if (!event.starts_at) return false;
    const start = koreanInput(event.starts_at).slice(0, 10);
    const end = event.ends_at && Date.parse(event.ends_at) > Date.parse(event.starts_at) ? koreanInput(new Date(Date.parse(event.ends_at) - 1).toISOString()).slice(0, 10) : start;
    return start <= day && end >= day;
  }
  function move(delta: number) {
    const next = new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
    setMonth(next); onMonthChange(next); setSelected(null);
  }
  const inMonth = events.filter(event => Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`).some(day => onDay(event, day)));
  const shown = new Set((selected ? events.filter(event => onDay(event, selected)) : inMonth).map(event => event.id));
  return <>
    {month ? <section aria-label="월별 일정 달력">
      <div className={styles.monthBar}><button className={styles.monthStep} aria-label="이전 달" onClick={() => move(-1)}><SiteIcon name="arrow" size={18} style={{ transform: "scaleX(-1)" }} /></button><h2 aria-live="polite">{year}년 {number}월</h2><button className={styles.monthStep} aria-label="다음 달" onClick={() => move(1)}><SiteIcon name="arrow" size={18} /></button><button className={styles.today} onClick={() => { const next = currentMonth(); setMonth(next); onMonthChange(next); setSelected(null); }}>이번 달</button></div>
      <div className={styles.calendarScroll}><div className={styles.calendar}>
        {["일", "월", "화", "수", "목", "금", "토"].map(day => <span className={styles.weekday} key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = `${month}-${String(index + 1).padStart(2, "0")}`;
          const count = events.filter(event => onDay(event, day)).length;
          return <button key={day} aria-label={`${day} 일정 ${count}개`} aria-pressed={selected === day} data-today={day === today || undefined} data-has={count > 0 || undefined} onClick={() => setSelected(day)}>{index + 1}<span>{count ? `${count}개` : ""}</span></button>;
        })}
      </div></div>
      <div className={styles.dayBar}><p role="status">{selected ? `${monthDayWeek(selected)} 일정` : "이 달의 일정"}</p>{selected ? <button onClick={() => setSelected(null)}>이 달 전체 보기</button> : null}</div>
      {!shown?.size ? <p className={styles.state}>표시할 공개 일정이 없습니다.</p> : null}
    </section> : null}
    {children(shown)}
  </>;
}
