'use client';
import type { MouseEvent } from 'react';
import type { Heading } from './markdown';

/** 안내 목차: 누르면 그 절로 부드럽게 스크롤한다(움직임 줄이기 설정이면 바로 이동). */
export default function GuideToc({ headings, className }: { headings: Heading[]; className?: string }) {
  function go(id: string, event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
    history.replaceState(null, '', `#${id}`);
  }
  return <nav className={className} aria-label="안내 목차"><ol>{headings.map(({ id, text }) => <li key={id}><a href={`#${id}`} onClick={event => go(id, event)}>{text.replace(/^\d+\.\s*/, '')}</a></li>)}</ol></nav>;
}
