'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { torahWeek, weeksInYear } from '@/lib/korean-date';
import { displayTitle } from '@/lib/bulletin-presentation';
import SiteIcon from '../site-icon';
import css from './torah.module.css';
import bar from '../bulletins/reader.module.css';

type Entry = { id: string; title: string; body: string; content: { reference?: string } | null };
type Week = { serviceDate: string; issueNumber: number; reference: string };
type Data = { dates: Week[]; items: Entry[]; serviceDate: string | null; issueNumber: number | null };

/** 토라&토브 by week: ‹ 26-45주차 (11/9~11/14) › and a searchable list of other weeks at the bottom. */
export default function TorahReader() {
  // ?date=YYYY-MM-DD opens that week (nothing date-dependent renders before data arrives).
  const [selected, setSelected] = useState<string | null>(() => { if (typeof window === 'undefined') return null; const date = new URLSearchParams(location.search).get('date'); return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null; });
  const [data, setData] = useState<Data | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const [year, setYear] = useState<number | null>(null), [peek, setPeek] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bulletin-sections?section=torah-tov${selected ? `&date=${selected}` : ''}`, { cache: 'no-store', signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error(); setData(await r.json()); setFailed(false); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [selected, retry]);
  // 주차 번호 → 그 주차의 주보 (연도별). 데이터가 있는 주차만 누를 수 있다.
  const byYear = useMemo(() => {
    const map = new Map<number, Map<number, Week>>();
    for (const row of data?.dates ?? []) { const { year: y, week } = torahWeek(row.serviceDate); if (!map.has(y)) map.set(y, new Map()); map.get(y)!.set(week, row); }
    return map;
  }, [data]);
  const years = useMemo(() => [...byYear.keys()].sort((x, y) => y - x), [byYear]);
  function openFinder() { setYear(data?.serviceDate ? torahWeek(data.serviceDate).year : years[0] ?? null); setPeek(null); dialog.current?.showModal(); }
  function choose(date: string, scroll = false) {
    setSelected(date); dialog.current?.close();
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
        <button ref={toggle} type="button" className={css.findToggle} onClick={openFinder}>다른 주차 찾기<SiteIcon name="chevron" size={16} /></button>
        {current ? <Link className={css.more} href={`/bulletins/${current}`}>이 주보 전체 보기<SiteIcon size={16} /></Link> : null}
      </div>
    </section>
    <dialog ref={dialog} className={css.finder} aria-label="주차 선택" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }} onClose={() => { setPeek(null); toggle.current?.focus(); }}>
      {year !== null ? <FinderBody year={year} years={years} weeks={byYear.get(year) ?? new Map()} current={current} peek={peek} onPeek={setPeek} onYear={setYear} onPick={date => choose(date, true)} onClose={() => dialog.current?.close()} /> : null}
    </dialog>
  </div>;
}

/** 한 해를 8×7 칸으로: 1주차부터 52(53)주차, 주보가 있는 주차만 누를 수 있다. */
function FinderBody({ year, years, weeks, current, peek, onPeek, onYear, onPick, onClose }: { year: number; years: number[]; weeks: Map<number, Week>; current: string | null; peek: string | null; onPeek: (value: string | null) => void; onYear: (year: number) => void; onPick: (date: string) => void; onClose: () => void }) {
  const total = weeksInYear(year), shown = (peek && [...weeks.values()].find(row => row.serviceDate === peek)) || null;
  const older = years[years.indexOf(year) + 1], newer = years[years.indexOf(year) - 1];
  return <div className={css.finderBody}>
    <div className={css.finderHead}>
      <button type="button" className={bar.step} aria-label="이전 해" disabled={!older} onClick={() => older && onYear(older)}><SiteIcon name="arrow" size={18} style={{ transform: 'scaleX(-1)' }} /></button>
      <strong>{year}년</strong>
      <button type="button" className={bar.step} aria-label="다음 해" disabled={!newer} onClick={() => newer && onYear(newer)}><SiteIcon name="arrow" size={18} /></button>
    </div>
    <ol className={css.weekGrid}>{Array.from({ length: 56 }, (_, i) => {
      const number = i + 1, row = number <= total ? weeks.get(number) : undefined;
      if (number > total) return <li key={number} aria-hidden="true" />;
      return <li key={number}>{row
        ? <button type="button" aria-current={row.serviceDate === current ? 'true' : undefined} onClick={() => onPick(row.serviceDate)} onMouseEnter={() => onPeek(row.serviceDate)} onFocus={() => onPeek(row.serviceDate)} onMouseLeave={() => onPeek(null)} onBlur={() => onPeek(null)}><b>{number}</b><span>주차</span></button>
        : <span className={css.weekEmpty} aria-label={`${number}주차 없음`}><b>{number}</b><span>주차</span></span>}</li>;
    })}</ol>
    <p className={css.finderPeek} aria-live="polite">{shown ? <><strong>{torahWeek(shown.serviceDate).label}</strong><em>{torahWeek(shown.serviceDate).range}</em>{shown.reference ? <small>{shown.reference}</small> : null}</> : <span>주차를 누르면 그 주의 토라&amp;토브로 이동해요.</span>}</p>
    <button type="button" className={css.finderClose} onClick={onClose}>닫기</button>
  </div>;
}
