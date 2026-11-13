"use client";
import { useEffect, useState } from "react";
import { churchLabels } from "@/lib/church";
import styles from "../public-content.module.css";
export default function ChurchReader() {
  const [fields, setFields] = useState<{ key: string; body: string }[]>([]), [message, setMessage] = useState("교회 안내를 불러오고 있습니다…");
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { const controller = new AbortController(); let sequence = 0;
    async function load() { const current = ++sequence; try { const response = await fetch("/api/church", { cache: "no-store", signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!controller.signal.aborted && current === sequence) { setFields(data.fields); setFailed(false); setMessage(data.fields.some((f: { body: string }) => f.body.trim()) ? "" : "교회 안내를 준비 중입니다."); } } catch { if (!controller.signal.aborted && current === sequence) { setFields([]); setFailed(true); setMessage("교회 안내를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); } } }
    void load(); const timer = window.setInterval(load, 15000); window.addEventListener("focus", load); return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); };
  }, [retry]);
  const order = ["introduction", "worship", "address", "directions", "phone", "name"];
  const visible = fields.filter(field => field.body.trim() && order.includes(field.key)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return <main id="public-content" tabIndex={-1} className={styles.page}>
    <header className={styles.heading}><p>처음 오신 여러분을 환영합니다</p><h1>교회 안내</h1><p>교회 소개와 예배 시간, 오시는 길을 안내합니다.</p></header>
    {message ? <div className={styles.state}><p role="status">{message}</p>{failed ? <button onClick={() => { setMessage("교회 안내를 불러오고 있습니다…"); setFailed(false); setRetry(value => value + 1); }}>다시 불러오기</button> : null}</div> : null}
    {visible.length ? <nav className={styles.shortcuts} aria-label="교회 안내 바로가기">{visible.map(field => <a key={field.key} href={`#church-${field.key}`}>{churchLabels[field.key]}</a>)}</nav> : null}
    <div className={styles.guide}>{visible.map(field => <section id={`church-${field.key}`} tabIndex={-1} className={styles.card} key={field.key}><h2>{churchLabels[field.key]}</h2><p className={styles.body}>{field.body}</p></section>)}</div>
  </main>;
}
