"use client";
import { useEffect, useState } from "react";
import { BlockPreview } from "../admin/bulletins/block-fields";
import type { BulletinItem } from "@/lib/bulletins";
import styles from "../admin/bulletins/workspace.module.css";

type PublicItem = Pick<BulletinItem, "id" | "title" | "body" | "kind" | "content">;
type Summary = { id: string; service_date: string; issue_number: number };
export default function PublicBulletins() {
  const [rows, setRows] = useState<Summary[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [bulletin, setBulletin] = useState<(Summary & { items: PublicItem[] }) | null>(null);
  const [message, setMessage] = useState("주보를 불러오고 있습니다…");
  const [retry, setRetry] = useState(0);
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
        if (!selected) { setBulletin(null); setMessage("아직 게시된 주보가 없습니다."); return; }
        const detail = await fetch(`/api/bulletins?id=${encodeURIComponent(selected)}`, { cache: "no-store", signal: controller.signal });
        const content = await detail.json();
        if (controller.signal.aborted || currentRequest !== requestNumber) return;
        if (!detail.ok) throw new Error(content.error);
        setBulletin(content); setMessage("");
      } catch (error) {
        if (controller.signal.aborted || currentRequest !== requestNumber) return;
        setBulletin(null); setMessage(error instanceof Error ? error.message : "주보를 불러오지 못했습니다.");
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [id, retry]);
  return <main id="public-content" className={styles.page}><header className={styles.header}><div><span>꿈꾸는좋은교회</span><h1>주일 주보</h1></div></header>

    <p role="status">{message}</p>{message ? <button onClick={() => setRetry((value) => value + 1)}>다시 불러오기</button> : null}
    <nav aria-label="지난 주보" className={styles.actions}>{rows.map((row) => <button key={row.id} aria-pressed={bulletin?.id === row.id} onClick={() => { setBulletin(null); setMessage("주보를 불러오고 있습니다…"); setId(row.id); }}>{row.service_date} · {row.issue_number}호</button>)}</nav>
    {bulletin ? <section className={styles.card}><h2>{bulletin.service_date} · {bulletin.issue_number}호</h2>{bulletin.items.map((item) => <BlockPreview key={item.id} item={item} />)}</section> : null}
  </main>;
}
