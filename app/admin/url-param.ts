'use client';
import { useCallback, useSyncExternalStore } from 'react';

/*
 * 관리 화면의 '어느 화면을 보고 있는지'를 주소(?song=…)에 싣는 훅.
 * 화면 상태만 state로 바꾸면 브라우저 기록에는 아무 것도 남지 않아, 뒤로가기가 한 화면이 아니라 아예 이전 페이지로 나간다.
 * 주소에 실으면 뒤로·앞으로·새로고침·링크 공유가 모두 브라우저 기본 동작대로 맞아떨어진다.
 *
 * - 새 화면으로 들어갈 때는 'push'(뒤로가기로 돌아올 수 있음)
 * - 오류·로그아웃처럼 기록에 남기면 안 되는 전환은 'replace'
 */
const CHANGE = 'church-admin:url-change';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => { window.removeEventListener('popstate', onChange); window.removeEventListener(CHANGE, onChange); };
}

export function useUrlParam(name: string): [string | null, (value: string | null, mode?: 'push' | 'replace') => void] {
  // 서버 렌더링과 첫 하이드레이션 값은 null(로그인 확인 전이라 어차피 화면을 그리지 않는다).
  const value = useSyncExternalStore(subscribe, () => new URLSearchParams(window.location.search).get(name), () => null);
  const set = useCallback((next: string | null, mode: 'push' | 'replace' = 'push') => {
    const url = new URL(window.location.href);
    if (next === null) url.searchParams.delete(name); else url.searchParams.set(name, next);
    if (url.href === window.location.href) return;
    if (mode === 'push') window.history.pushState(null, '', url); else window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(CHANGE));
  }, [name]);
  return [value, set];
}
