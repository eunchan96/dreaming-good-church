'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { longDate, torahWeek } from '@/lib/korean-date';
import { displayTitle } from '@/lib/bulletin-presentation';
import SiteIcon from '../site-icon';
import css from './torah.module.css';
import bar from '../bulletins/reader.module.css';

type Entry = { id: string; title: string; body: string; content: { reference?: string } | null };
type Week = { serviceDate: string; issueNumber: number; reference: string };
type Data = { dates: Week[]; items: Entry[]; serviceDate: string | null; issueNumber: number | null };

const squash = (value: string) => value.replace(/\s+/g, '').toLowerCase();

/** 토라&토브 by week: ‹ 26-45주차 (11/9~11/14) › and a searchable list of other weeks at the bottom. */
export default function TorahReader() {
  // ?date=YYYY-MM-DD opens that week (nothing date-dependent renders before data arrives).
  const [selected, setSelected] = useState<string | null>(() => { if (typeof window === 'undefined') return null; const date = new URLSearchParams(location.search).get('date'); return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null; });
  const [data, setData] = useState<Data | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const panel = useRef<HTMLDivElement>(null), toggle = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bulletin-sections?section=torah-tov${selected ? `&date=${selected}` : ''}`, { cache: 'no-store', signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); setData(await r.json()); setFailed(false); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [selected, retry]);
  // Close the 다른 주차 panel on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const away = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !toggle.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const groups = useMemo(() => {
    const needle = squash(query).replace(/주차$/, '');
    const found = (data?.dates ?? []).map(week => ({ week, info: torahWeek(week.serviceDate) })).filter(({ week, info }) => !needle || squash(`${info.label} ${info.range} ${week.reference} ${week.serviceDate}`).includes(needle) || squash(`${info.week}주차`).includes(needle));
    return found.reduce<{ label: string; rows: typeof found }[]>((all, row) => { const label = `${row.info.year}년`; const last = all.at(-1); if (last?.label === label) last.rows.push(row); else all.push({ label, rows: [row] }); return all; }, []);
  }, [data, query]);
  function choose(date: string, scroll = false) {
    setSelected(date); setOpen(false); setQuery('');
    const url = new URL(location.href); url.searchParams.set('date', date); history.replaceState(null, '', url);
    if (scroll) document.getElementById('torah-top')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  if (failed) return <div className={css.state}><p role="status">주보의 공개 안내를 불러오지 못했습니다.</p><button type="button" onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></div>;
  if (!data) return <p role="status" className={css.loading}>토라&amp;토브를 불러오고 있습니다…</p>;
  if (!data.dates.length) return <div className={css.state}><p>아직 공개된 토라&amp;토브가 없습니다.</p></div>;
  const current = data.serviceDate;
  const week = current ? torahWeek(current) : null;
  const index = data.dates.findIndex(row => row.serviceDate === current);
  const newer = index > 0 ? data.dates[index - 1] : null, older = index >= 0 ? data.dates[index + 1] ?? null : null;
  return <div>
    <div id="torah-top" className={bar.issueBar}>
      <button type="button" className={bar.step} aria-label="이전 주차" title="이전 주차" disabled={!older} onClick={() => older && choose(older.serviceDate)}><SiteIcon name="arrow" size={18} style={{ transform: 'scaleX(-1)' }} /></button>
      <div className={css.weekTitle}>{week ? <><strong>{week.label}</strong><span>({week.range})</span></> : <strong>토라&amp;토브</strong>}</div>
      <button type="button" className={bar.step} aria-label="다음 주차" title="다음 주차" disabled={!newer} onClick={() => newer && choose(newer.serviceDate)}><SiteIcon name="arrow" size={18} /></button>
    </div>
    <section id="torah-week" className={css.week} aria-label={week ? `${week.label} 토라&토브` : '토라&토브'}>
      {data.items.length ? <div className={css.entries}>{data.items.map(item => <article key={item.id}>
        <h3>{displayTitle(item.title)}</h3>
        {item.content?.reference?.trim() ? <p className={css.reference}>{item.content.reference}</p> : null}
        {item.body.trim() ? <blockquote>{item.body}</blockquote> : null}
      </article>)}</div> : <p className={css.empty}>이 주차에는 토라&amp;토브가 없습니다.</p>}
      <div className={css.footRow}>
        <div className={css.findWrap}>
          <button ref={toggle} type="button" className={css.findToggle} aria-expanded={open} aria-controls="torah-find" onClick={() => setOpen(value => !value)}>다른 주차 찾기<SiteIcon name="chevron" size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} /></button>
          {open ? <div ref={panel} id="torah-find" className={css.findPanel} role="region" aria-label="다른 주차 찾기">
            <input ref={search} type="search" className={css.findInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="주차·날짜·성경 본문 (예: 45, 11/9, 시편)" aria-label="주차 검색" />
            <div className={css.findList}>{groups.length ? groups.map(group => <section key={group.label}><h3>{group.label}</h3><ul>{group.rows.map(({ week: row, info }) => <li key={row.serviceDate}><button type="button" aria-current={row.serviceDate === current ? 'true' : undefined} onClick={() => choose(row.serviceDate, true)}><span><strong>{info.label}</strong><em>{info.range}</em></span>{row.reference ? <small>{row.reference}</small> : null}</button></li>)}</ul></section>) : <p className={css.findEmpty}>찾는 주차가 없습니다.</p>}</div>
          </div> : null}
        </div>
        {current ? <Link className={css.more} href={`/bulletins/${current}`}>이 주보 전체 보기<SiteIcon size={16} /></Link> : null}
      </div>
    </section>
  </div>;
}
