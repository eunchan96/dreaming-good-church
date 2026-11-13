'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { worshipTypes, additionalWorshipTimes, type WorshipType } from '@/lib/site-content';
import styles from './public-site.module.css';
export default function WorshipTimes({ weekly = false, additional = false }: { weekly?: boolean; additional?: boolean }) {
  const [data, setData] = useState<{ serviceDate: string | null; readings: Partial<Record<WorshipType,string>> } | null>(null);
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!weekly) return;
    const controller = new AbortController(); let sequence = 0;
    async function load() { const current = ++sequence; try {
      const r = await fetch('/api/bulletin-sections?section=worship', { cache:'no-store', signal:controller.signal });
      if (!r.ok) throw new Error(); const result = await r.json();
      if (!controller.signal.aborted && current === sequence) { setData(result); setFailed(false); }
    } catch { if (!controller.signal.aborted && current === sequence) { setData(null); setFailed(true); } } }
    void load(); const timer = window.setInterval(load,15000); window.addEventListener('focus',load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus',load); };
  }, [weekly,retry]);
  const times = additional ? [...worshipTypes,...additionalWorshipTimes] : worshipTypes;
  return <section className={styles.worshipTimes} aria-labelledby="worship-times-title"><p className={styles.eyebrow}>GATHER IN WORSHIP</p><h2 id="worship-times-title">함께 예배하는 시간</h2><div className={styles.timeGrid}>{times.map(w => <div key={w.key}><span>{w.english}</span><h3>{w.name}</h3><p>{w.time}</p>{weekly && data?.readings[w.key as WorshipType] ? <p className={styles.weeklyReading}><b>이번 주 말씀</b>{data.readings[w.key as WorshipType]}</p> : null}</div>)}</div>{weekly && failed ? <p role="status" className={styles.readingsNote}>이번 주 말씀을 불러오지 못했습니다. <button onClick={() => setRetry(x => x + 1)}>다시 불러오기</button></p> : weekly && data?.serviceDate && Object.keys(data.readings).length ? <p className={styles.readingsNote}>{data.serviceDate} 공개 주보 기준 · <Link href={`/bulletins/${data.serviceDate}`}>주보 보기</Link></p> : null}</section>;
}
