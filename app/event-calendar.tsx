"use client";
import { useState } from "react";
import { koreanInput } from "@/lib/community";
import styles from "./public-content.module.css";

type Event = { id: string; starts_at: string | null; ends_at: string | null };
export default function EventCalendar({ events, children, onMonthChange }: { events: Event[]; children: (ids: Set<string> | null) => React.ReactNode; onMonthChange: (month: string | null) => void }) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const currentMonth = () => koreanInput(new Date().toISOString()).slice(0, 7);
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
  const shown = view === "list" ? null : new Set((selected ? events.filter(event => onDay(event, selected)) : inMonth).map(event => event.id));
  return <>
    <div className={styles.controls} aria-label="일정 보기 방식"><button aria-pressed={view === "list"} onClick={() => { setView("list"); onMonthChange(null); }}>목록 보기</button><button aria-pressed={view === "calendar"} onClick={() => { const next = month || currentMonth(); setMonth(next); onMonthChange(next); setView("calendar"); }}>달력 보기</button></div>
    {view === "calendar" ? <section aria-label="월별 일정 달력">
      <div className={styles.controls}><button onClick={() => move(-1)}>이전 달</button><h2 aria-live="polite">{month.replace("-", "년 ")}월</h2><button onClick={() => move(1)}>다음 달</button><button onClick={() => { const next = currentMonth(); setMonth(next); onMonthChange(next); setSelected(null); }}>이번 달</button></div>
      <p>한국 시간 기준 · 선택한 월의 공개 일정을 표시합니다.</p>
      <div className={styles.calendarScroll}><div className={styles.calendar}>
        {["일", "월", "화", "수", "목", "금", "토"].map(day => <span className={styles.weekday} key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = `${month}-${String(index + 1).padStart(2, "0")}`;
          const count = events.filter(event => onDay(event, day)).length;
          return <button key={day} aria-label={`${day} 일정 ${count}개`} aria-pressed={selected === day} onClick={() => setSelected(day)}>{index + 1}<span>{count ? `${count}개` : ""}</span></button>;
        })}
      </div></div>
      <div className={styles.controls}><p role="status">{selected ? `${selected} 일정` : "이 달의 일정"}</p>{selected ? <button onClick={() => setSelected(null)}>이 달 전체 보기</button> : null}</div>
      {!shown?.size ? <p className={styles.state}>표시할 공개 일정이 없습니다.</p> : null}
    </section> : null}
    {children(shown)}
  </>;
}
