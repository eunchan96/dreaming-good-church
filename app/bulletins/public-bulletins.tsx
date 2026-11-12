"use client";
import { useEffect, useState } from "react";
import { BlockPreview } from "../admin/bulletins/block-fields";
import type { BulletinItem } from "@/lib/bulletins";
import styles from "./reader.module.css";
import PublicPdfDownload from "./public-pdf-download";

type PublicItem = Pick<BulletinItem, "id" | "title" | "body" | "kind" | "content">;
type Summary = { id: string; service_date: string; issue_number: number };
export default function PublicBulletins({ initialDate }: { initialDate?: string }) {
  const [rows, setRows] = useState<Summary[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [bulletin, setBulletin] = useState<(Summary & { items: PublicItem[] }) | null>(null);
  const [message, setMessage] = useState("주보를 불러오고 있습니다…");
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [month, setMonth] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [previous, setPrevious] = useState<(string | null)[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState("목록을 불러오고 있습니다…");
  const [historyFailed, setHistoryFailed] = useState(false);
  const [historyRetry, setHistoryRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    async function refreshHistory() {
      const current = ++sequence;
      try {
        const query = new URLSearchParams();
        if (month) query.set("month", month);
        if (cursor) query.set("before", cursor);
        const response = await fetch(`/api/bulletins?${query}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted || current !== sequence) return;
        if (!response.ok) throw new Error(data.error);
        setRows(data.bulletins); setNextCursor(data.nextCursor ?? null); setHistoryFailed(false);
        setHistoryMessage(data.bulletins.length ? "" : "선택한 범위에 표시할 주보가 없습니다.");
      } catch {
        if (controller.signal.aborted || current !== sequence) return;
        setRows([]); setNextCursor(null); setHistoryFailed(true); setHistoryMessage("지난 주보 목록을 불러오지 못했습니다.");
      }
    }
    void refreshHistory();
    const timer = window.setInterval(refreshHistory, 15000);
    window.addEventListener("focus", refreshHistory);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refreshHistory); };
  }, [month, cursor, historyRetry]);
  function changeHistory(nextMonth: string, next: string | null, stack: (string | null)[]) {
    setRows([]); setNextCursor(null); setHistoryFailed(false); setHistoryMessage("목록을 불러오고 있습니다…");
    setMonth(nextMonth); setCursor(next); setPrevious(stack);
  }
  useEffect(() => {
    const controller = new AbortController();
    let requestNumber = 0;
    async function refresh() {
      const currentRequest = ++requestNumber;
      try {
        const list = await fetch("/api/bulletins", { cache: "no-store", signal: controller.signal });
        const data = await list.json();
        if (controller.signal.aborted || currentRequest !== requestNumber) return;
        if (!list.ok) throw new Error(data.error);
        const selected = id ?? (initialDate ? null : data.bulletins[0]?.id);
        if (!selected && !initialDate) { setBulletin(null); setFailed(false); setMessage("아직 게시된 주보가 없습니다."); return; }
        const query = selected ? `id=${encodeURIComponent(selected)}` : `date=${encodeURIComponent(initialDate!)}`;
        const detail = await fetch(`/api/bulletins?${query}`, { cache: "no-store", signal: controller.signal });
        const content = await detail.json();
        if (controller.signal.aborted || currentRequest !== requestNumber) return;
        if (!detail.ok) throw new Error(content.error);
        setBulletin(content); setMessage(""); setFailed(false);
      } catch (error) {
        if (controller.signal.aborted || currentRequest !== requestNumber) return;
        setBulletin(null); setFailed(true); setMessage(error instanceof Error ? error.message : "주보를 불러오지 못했습니다.");
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [id, retry, initialDate]);
  return <main id="public-content" className={styles.page}>
    <header className={styles.heading}><p>함께 드리는 예배</p><h1>주일 주보</h1><p>말씀과 예배 순서, 이번 주 교회 소식을 만나보세요.</p></header>
    <details className={styles.history}>
      <summary>지난 주보 보기</summary>
      <div className={styles.filters}><label>주보 발행 월<input type="month" value={month} onChange={event => changeHistory(event.target.value, null, [])} /></label>{month ? <button onClick={() => changeHistory("", null, [])}>전체 월 보기</button> : null}</div>
      <p>{month || "전체 기간"} · {previous.length + 1}페이지 · 한 번에 최대 20개</p>
      <nav aria-label="지난 주보" className={styles.historyList}>{rows.map(row => <button key={row.id} aria-pressed={bulletin?.id === row.id} onClick={() => {
        if (bulletin?.id === row.id) return;
        setBulletin(null); setCopyMessage(""); setFailed(false); setMessage("주보를 불러오고 있습니다…"); setId(row.id); setRetry(value => value + 1);
      }}>{row.service_date} · {row.issue_number}호</button>)}</nav>
      {historyMessage ? <p role="status">{historyMessage}</p> : null}
      {historyFailed ? <button onClick={() => setHistoryRetry(value => value + 1)}>목록 다시 불러오기</button> : null}
      <div className={styles.filters}>{previous.length ? <button onClick={() => changeHistory(month, previous.at(-1)!, previous.slice(0, -1))}>이전 페이지</button> : null}{nextCursor ? <button onClick={() => changeHistory(month, nextCursor, [...previous, cursor])}>다음 페이지</button> : null}</div>
    </details>
    {message ? <p role="status" className={styles.message}>{message}</p> : null}
    {failed ? <button onClick={() => setRetry(value => value + 1)}>다시 불러오기</button> : null}
    {bulletin ? <div className={styles.reading}>
      <nav aria-label="주보 구역 바로가기" className={styles.contents}><h2>주보 목차</h2><ul>{bulletin.items.map((item, index) => <li key={item.id}><a href={`#bulletin-item-${item.id}`}>{String(index + 1).padStart(2, "0")} · {item.title || "주보 항목"}</a></li>)}</ul><a href="#public-content">맨 위로 ↑</a></nav>
      <section className={styles.paper} aria-label="선택한 주보"><h2>{bulletin.service_date} · {bulletin.issue_number}호</h2>
        <div><a href={`/bulletins/${bulletin.service_date}`}>이 주보의 고유 주소</a> · <button onClick={async () => {
          const url = new URL(`/bulletins/${bulletin.service_date}`, window.location.origin).href;
          try { await navigator.clipboard.writeText(url); setCopyMessage("주보 링크를 복사했습니다."); }
          catch { setCopyMessage("자동 복사를 사용할 수 없습니다. 고유 주소를 열고 주소창에서 복사해 주세요."); }
        }}>링크 복사</button><p role="status">{copyMessage}</p></div>
        <PublicPdfDownload key={bulletin.id} date={bulletin.service_date} />
        {!bulletin.items.length ? <p>웹에 공개된 주보 항목이 없습니다.</p> : null}
        {bulletin.items.map(item => <section className={styles.block} id={`bulletin-item-${item.id}`} tabIndex={-1} key={item.id} aria-label={item.title || "주보 항목"}><BlockPreview item={item} /></section>)}
        <a className={styles.top} href="#public-content">주보 맨 위로 ↑</a>
      </section>
    </div> : null}
  </main>;
}
