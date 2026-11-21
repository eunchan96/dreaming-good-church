'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { longDate, monthDay } from '@/lib/korean-date';
import { displayTitle } from '@/lib/bulletin-presentation';
import SiteIcon from '../site-icon';
import css from './torah.module.css';

type Entry = { id: string; title: string; body: string; content: { reference?: string } | null };
type Week = { serviceDate: string; issueNumber: number; reference: string };
type Data = { dates: Week[]; items: Entry[]; serviceDate: string | null; issueNumber: number | null };

/** 토라&토브 by week: list of bulletin dates, the chosen week's 나의 묵상·토라&토브 beside it. */
export default function TorahReader() {
  // ?date=YYYY-MM-DD opens that week (nothing date-dependent renders before data arrives).
  const [selected, setSelected] = useState<string | null>(() => { if (typeof window === 'undefined') return null; const date = new URLSearchParams(location.search).get('date'); return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null; });
  const [data, setData] = useState<Data | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bulletin-sections?section=torah-tov${selected ? `&date=${selected}` : ''}`, { cache: 'no-store', signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); setData(await r.json()); setFailed(false); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [selected, retry]);
  function choose(date: string) {
    setSelected(date);
    const url = new URL(location.href); url.searchParams.set('date', date); history.replaceState(null, '', url);
    if (matchMedia('(max-width: 860px)').matches) document.getElementById('torah-week')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (failed) return <div className={css.state}><p role="status">주보의 공개 안내를 불러오지 못했습니다.</p><button type="button" onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></div>;
  if (!data) return <p role="status" className={css.loading}>토라&amp;토브를 불러오고 있습니다…</p>;
  if (!data.dates.length) return <div className={css.state}><p>아직 공개된 토라&amp;토브가 없습니다.</p></div>;
  const current = data.serviceDate;
  return <div className={css.layout}>
    <nav className={css.weeks} aria-label="토라&토브 날짜">
      <h2>주보 날짜</h2>
      <ul>{data.dates.map(week => <li key={week.serviceDate}><button type="button" aria-current={week.serviceDate === current ? 'true' : undefined} onClick={() => choose(week.serviceDate)}><strong>{monthDay(week.serviceDate)}</strong><span>{week.serviceDate.slice(0, 4)}</span>{week.reference ? <small>{week.reference}</small> : null}</button></li>)}</ul>
    </nav>
    <section id="torah-week" className={css.week} aria-label={current ? `${longDate(current)} 토라&토브` : '토라&토브'}>
      {current ? <header><h2>{longDate(current)}</h2></header> : null}
      {data.items.length ? <div className={css.entries}>{data.items.map(item => <article key={item.id}>
        <h3>{displayTitle(item.title)}</h3>
        {item.content?.reference?.trim() ? <p className={css.reference}>{item.content.reference}</p> : null}
        {item.body.trim() ? <blockquote>{item.body}</blockquote> : null}
      </article>)}</div> : <p className={css.empty}>이 주보에는 토라&amp;토브가 없습니다.</p>}
      {current ? <Link className={css.more} href={`/bulletins/${current}`}>이 주보 전체 보기<SiteIcon size={16} /></Link> : null}
    </section>
  </div>;
}
