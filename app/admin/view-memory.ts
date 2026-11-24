'use client';
import { useEffect, useRef } from 'react';

/*
 * 새로고침해도 보던 관리 화면으로 돌아오게 한다.
 * 이 탭에서 보던 화면(목록·상세·편집…)과 열어 둔 항목 id를 sessionStorage에 적어 두었다가,
 * 목록을 다 불러온 뒤(ready) 한 번만 되살린다. 새 탭이나 로그아웃 뒤에는 기본 화면으로 시작한다.
 */
function recall<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null; } catch { return null; }
}
function remember(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장소를 못 쓰면 기억하지 않는다 */ }
}

export function useViewMemory<T>(key: string, ready: boolean, current: T, restore: (saved: T) => void) {
  const restored = useRef(false), restoreRef = useRef(restore), serialized = JSON.stringify(current);
  useEffect(() => { restoreRef.current = restore; });
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = recall<T>(key);
    if (saved) restoreRef.current(saved);
  }, [key, ready]);
  // 되살린 뒤부터 바뀐 화면을 적는다(되살리기 전에 기본 화면으로 덮어쓰지 않도록).
  useEffect(() => { if (restored.current) remember(key, JSON.parse(serialized)); }, [key, serialized]);
}
