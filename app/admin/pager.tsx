'use client';

import { useSyncExternalStore } from 'react';
import AdminIcon from './admin-icons';
import styles from './pager.module.css';

// 번호는 고정 묶음으로 보여 준다(넓은 화면 10개, 좁은 화면 5개): 1~10, 11~20, 21~25 …
const NARROW = '(max-width: 560px)';
const subscribe = (listener: () => void) => { const query = window.matchMedia(NARROW); query.addEventListener('change', listener); return () => query.removeEventListener('change', listener); };
const useNarrow = () => useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches, () => false);

/** 관리 화면 목록의 페이지 이동(곡 목록·영상 목록 공용). ‹ ›는 이전·다음 페이지, 묶음 끝에서 넘기면 다음 묶음이 보인다. 한 페이지뿐이면 그리지 않는다. */
export default function Pager({ label, current, pages, onPage }: { label: string; current: number; pages: number; onPage: (page: number) => void }) {
  const group = useNarrow() ? 5 : 10;
  if (pages <= 1) return null;
  const first = Math.floor((current - 1) / group) * group + 1, last = Math.min(pages, first + group - 1);
  const shown = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return <nav className={styles.pager} aria-label={label}>
    <button type="button" aria-label="이전 페이지" disabled={current === 1} onClick={() => onPage(current - 1)}><AdminIcon name="back" size={18} /></button>
    {shown.map(n => <button key={n} type="button" aria-label={`${n}페이지`} aria-current={n === current ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>)}
    <button type="button" aria-label="다음 페이지" disabled={current === pages} onClick={() => onPage(current + 1)}><AdminIcon name="forward" size={18} /></button>
  </nav>;
}
