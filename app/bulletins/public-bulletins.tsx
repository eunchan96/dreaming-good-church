"use client";
import { useEffect, useState } from "react";
import { BlockPreview } from "../admin/bulletins/block-fields";
import type { BulletinItem } from "@/lib/bulletins";
import styles from "./reader.module.css";

type PublicItem = Pick<BulletinItem, "id" | "title" | "body" | "kind" | "content">;
type Summary = { id: string; service_date: string; issue_number: number };
export default function PublicBulletins() {
  const [rows, setRows] = useState<Summary[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [bulletin, setBulletin] = useState<(Summary & { items: PublicItem[] }) | null>(null);
  const [message, setMessage] = useState("주보를 불러오고 있습니다…");
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [month, setMonth] = useState("");
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
        setRows(data.bulletins);
        const selected = id ?? data.bulletins[0]?.id;
        if (!selected) { setBulletin(null); setFailed(false); setMessage("아직 게시된 주보가 없습니다."); return; }
        const detail = await fetch(`/api/bulletins?id=${encodeURIComponent(selected)}`, { cache: "no-store", signal: controller.signal });
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
  }, [id, retry]);
  const history = rows.filter(row => !month || row.service_date.startsWith(month));
  return <main id="public-content" className={styles.page}>
    <header className={styles.heading}><p>함께 드리는 예배</p><h1>주일 주보</h1><p>말씀과 예배 순서, 이번 주 교회 소식을 만나보세요.</p></header>
    <details className={styles.history}>
      <summary>지난 주보 보기 <span>{rows.length}개</span></summary>
      <div className={styles.filters}><label>주보 발행 월<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>{month ? <button onClick={() => setMonth("")}>전체 월 보기</button> : null}</div>
      <p>최근 게시된 주보 최대 100개에서 찾습니다.</p>
      <nav aria-label="지난 주보" className={styles.historyList}>{history.map(row => <button key={row.id} aria-pressed={bulletin?.id === row.id} onClick={() => {
        if (bulletin?.id === row.id) return;
        setBulletin(null); setFailed(false); setMessage("주보를 불러오고 있습니다…"); setId(row.id); setRetry(value => value + 1);
      }}>{row.service_date} · {row.issue_number}호</button>)}</nav>
      {!history.length ? <p role="status">선택한 월에 표시할 주보가 없습니다.</p> : null}
    </details>
    {message ? <p role="status" className={styles.message}>{message}</p> : null}
    {failed ? <button onClick={() => setRetry(value => value + 1)}>다시 불러오기</button> : null}
    {bulletin ? <div className={styles.reading}>
      <nav aria-label="주보 구역 바로가기" className={styles.contents}><h2>주보 목차</h2><ul>{bulletin.items.map((item, index) => <li key={item.id}><a href={`#bulletin-item-${item.id}`}>{String(index + 1).padStart(2, "0")} · {item.title || "주보 항목"}</a></li>)}</ul><a href="#public-content">맨 위로 ↑</a></nav>
      <section className={styles.paper} aria-label="선택한 주보"><h2>{bulletin.service_date} · {bulletin.issue_number}호</h2>
        {!bulletin.items.length ? <p>웹에 공개된 주보 항목이 없습니다.</p> : null}
        {bulletin.items.map(item => <section className={styles.block} id={`bulletin-item-${item.id}`} tabIndex={-1} key={item.id} aria-label={item.title || "주보 항목"}><BlockPreview item={item} /></section>)}
        <a className={styles.top} href="#public-content">주보 맨 위로 ↑</a>
      </section>
    </div> : null}
  </main>;
}
