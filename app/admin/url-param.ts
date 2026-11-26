'use client';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

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

/*
 * 목록·상세·편집을 같은 페이지 안에서 state로 오가는 관리 화면(예배 영상·주보·공지·교회 소개)용.
 * 화면 전환 코드는 그대로 두고, 지금 보는 화면을 주소(?view=…&id=…)에 거울처럼 기록한다.
 *
 * - 사용자가 화면을 바꾸면 주소를 push해서 브라우저 뒤로가기가 한 화면씩 돌아가게 한다.
 * - 뒤로·앞으로(popstate)가 오면 restore(그 화면)를 부른다. 저장하지 않은 입력을 지키는 확인창은
 *   restore가 쓰는 기존 함수(mayLeave를 거치는 것)가 한 번만 띄운다. false를 돌려주면 이동을 거절한 것이라
 *   주소를 지금 화면으로 되돌린다.
 * - 처음 열 때 주소에 화면이 있으면(새로고침·링크 공유) 그 화면을 복원한다.
 * defaultView는 주소에 쓰지 않는 기본 화면(예: 목록)이다.
 */
export type ViewState = { view: string; id: string | null };

export function useViewHistory<T extends ViewState>({ ready, current, defaultView, restore }: {
  ready: boolean; current: T; defaultView: string; restore: (next: T) => boolean | void | Promise<boolean | void>;
}) {
  const latest = useRef({ current, restore });
  const started = useRef(false), stale = useRef<string | null>(null);
  useEffect(() => { latest.current = { current, restore }; });
  const serialized = `${current.view}|${current.id ?? ''}`;

  const urlFor = useCallback((state: ViewState) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('view'); url.searchParams.delete('id');
    if (state.view !== defaultView) url.searchParams.set('view', state.view);
    if (state.id) url.searchParams.set('id', state.id);
    url.hash = '';
    return url;
  }, [defaultView]);
  const here = () => window.location.pathname + window.location.search;
  const target = (state: ViewState) => { const url = urlFor(state); return url.pathname + url.search; };
  const read = useCallback((): ViewState => {
    const params = new URLSearchParams(window.location.search);
    return { view: params.get('view') ?? defaultView, id: params.get('id') };
  }, [defaultView]);

  // 처음 한 번: 주소에 화면이 있으면 복원한다(새로고침·링크 공유).
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const want = read(), now = latest.current.current;
    if (want.view === now.view && want.id === now.id) return;
    stale.current = `${now.view}|${now.id ?? ''}`;
    void Promise.resolve(latest.current.restore(want as T)).then(ok => {
      if (ok === false) { stale.current = null; window.history.replaceState(null, '', urlFor(latest.current.current)); }
    });
  }, [ready, read, urlFor]);

  // 사용자가 화면을 바꾸면 주소에 기록한다(복원 직전의 옛 값으로는 덮어쓰지 않는다).
  useEffect(() => {
    if (!ready || !started.current) return;
    if (stale.current !== null) { if (serialized === stale.current) return; stale.current = null; }
    if (target(latest.current.current) !== here()) window.history.pushState(null, '', urlFor(latest.current.current));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- target/here는 매 렌더 새로 만들어도 같은 값을 돌려준다
  }, [ready, serialized, urlFor]);

  // 뒤로·앞으로.
  useEffect(() => {
    async function onPop() {
      const want = read(), now = latest.current.current;
      if (want.view === now.view && want.id === now.id) return;
      const ok = await latest.current.restore(want as T);
      if (ok === false) window.history.pushState(null, '', urlFor(latest.current.current));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [read, urlFor]);
}
