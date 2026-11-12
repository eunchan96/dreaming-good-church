"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { churchLabels } from "@/lib/church";
import styles from "../admin/bulletins/workspace.module.css";
export default function ChurchReader() {
  const [fields, setFields] = useState<{ key: string; body: string }[]>([]), [message, setMessage] = useState("교회 안내를 불러오고 있습니다…");
  useEffect(() => { const controller = new AbortController(); let sequence = 0;
    async function load() { const current = ++sequence; try { const response = await fetch("/api/church", { cache: "no-store", signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!controller.signal.aborted && current === sequence) { setFields(data.fields); setMessage(data.fields.some((f: { body: string }) => f.body.trim()) ? "" : "교회 안내를 준비 중입니다."); } } catch { if (!controller.signal.aborted && current === sequence) { setFields([]); setMessage("교회 안내를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); } } }
    void load(); const timer = window.setInterval(load, 15000); window.addEventListener("focus", load); return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); };
  }, []);
  return <main className={styles.page}><h1>교회 안내</h1><nav><Link href="/bulletins">주보</Link> · <Link href="/notices">공지</Link> · <Link href="/events">일정</Link></nav><p role="status">{message}</p>{fields.filter(f => f.body.trim()).map(f => <section className={styles.card} key={f.key}><h2>{churchLabels[f.key]}</h2><p style={{ whiteSpace: "pre-wrap" }}>{f.body}</p></section>)}</main>;
}
