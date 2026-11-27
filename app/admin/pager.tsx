'use client';

import { useSyncExternalStore } from 'react';
import AdminIcon from './admin-icons';
import styles from './pager.module.css';

// 좁은 화면에서는 현재 페이지 앞뒤로 1개씩만 보여 한 줄에 맞춘다(넓은 화면은 2개씩).
const NARROW = '(max-width: 560px)';
const subscribe = (listener: () => void) => { const query = window.matchMedia(NARROW); query.addEventListener('change', listener); return () => query.removeEventListener('change', listener); };
const useNarrow = () => useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches, () => false);

/** 관리 화면 목록의 페이지 이동(곡 목록·영상 목록 공용). 한 페이지뿐이면 그리지 않는다. */
export default function Pager({ label, current, pages, onPage }: { label: string; current: number; pages: number; onPage: (page: number) => void }) {
  const around = useNarrow() ? 1 : 2;
  if (pages <= 1) return null;
  const shown = Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - current) <= around);
  return <nav className={styles.pager} aria-label={label}>
    <button type="button" aria-label="이전 페이지" disabled={current === 1} onClick={() => onPage(current - 1)}><AdminIcon name="back" size={18} /></button>
    {shown.map((n, i) => <span key={n}>
      {i && n - shown[i - 1] > 1 ? <span className={styles.gap} aria-hidden="true">…</span> : null}
      <button type="button" aria-label={`${n}페이지`} aria-current={n === current ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
    </span>)}
    <button type="button" aria-label="다음 페이지" disabled={current === pages} onClick={() => onPage(current + 1)}><AdminIcon name="forward" size={18} /></button>
  </nav>;
}
