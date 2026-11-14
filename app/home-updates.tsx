"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./public-site.module.css";
import SiteIcon from './site-icon';

type Item = { id: string; title: string; body?: string; service_date?: string; starts_at?: string | null; ends_at?: string | null };
type Feed = "bulletins" | "notice" | "event" | "church";
const urls: Record<Feed, string> = { bulletins: "/api/bulletins", notice: "/api/community?kind=notice", event: "/api/community?kind=event", church: "/api/church" };

function FeedCard({ feed, title, href }: { feed: Feed; title: string; href: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("불러오고 있습니다…");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    async function refresh() {
      const current = ++sequence;
      try {
        const response = await fetch(urls[feed], { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("조회 실패");
        const data = await response.json();
        if (controller.signal.aborted || current !== sequence) return;
        let next: Item[];
        if (feed === "church") {
          next = data.fields.filter((field: { key: string; body: string }) => field.key === "introduction" && field.body.trim()).map((field: { key: string; body: string }) => ({ id: field.key, title: "우리 교회 이야기", body: field.body }));
        } else if (feed === "bulletins") {
          next = data.bulletins.slice(0, 1).map((row: { id: string; service_date: string; issue_number: number }) => ({ ...row, title: `${row.service_date} · ${row.issue_number}호` }));
        } else {
          next = data.entries;
          if (feed === "event") next = next.filter(row => row.starts_at && Date.parse(row.ends_at ?? row.starts_at) >= Date.now());
        }
        setItems(next.slice(0, 3));
        setStatus(next.length ? "" : feed === "church" ? "교회 소개를 준비하고 있습니다." : "현재 공개된 소식이 없습니다.");
        setFailed(false);
      } catch {
        if (controller.signal.aborted || current !== sequence) return;
        setItems([]); setStatus("소식을 불러오지 못했습니다."); setFailed(true);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [feed, retry]);
  return <section className={styles.feed} aria-label={title}>
    <div className={styles.feedHeading}><h2>{title}</h2><Link href={href} aria-label={`${title} 전체 보기`}>전체 보기 <SiteIcon size={17} /></Link></div>
    {status ? <p role="status">{status}</p> : null}
    {failed ? <button onClick={() => setRetry(value => value + 1)}>다시 불러오기</button> : null}
    <ul>{items.map(item => <li key={item.id}><Link href={href}>{item.title}</Link>{item.starts_at ? <p>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.starts_at))}</p> : null}{item.body && feed === "church" ? <p className={styles.introduction}>{item.body}</p> : null}</li>)}</ul>
  </section>;
}

export default function HomeUpdates() {
  return <div className={styles.feeds}><FeedCard feed="bulletins" title="이번 주 주보" href="/bulletins" /><FeedCard feed="church" title="교회 소개" href="/church" /><FeedCard feed="notice" title="교회 소식" href="/notices" /><FeedCard feed="event" title="다가오는 일정" href="/events" /></div>;
}
