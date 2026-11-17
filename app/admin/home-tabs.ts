'use client';
/** 홈페이지 관리 tabs shared by /admin/home (홈 화면) and /admin/church (교회 소개 · 이미지 관리). */
export type HomeTab = 'home' | 'church' | 'images';
type Section = { id: string; label: string };
const paths: Record<HomeTab, string> = { home: '/admin/home', church: '/admin/church', images: '/admin/church?view=images' };

export function homeTabs(current: HomeTab, sections: Section[], options: { canLeave: () => boolean; onSelect?: (tab: HomeTab) => boolean | void }) {
  const go = (tab: HomeTab) => {
    if (tab === current) return;
    // Same route (교회 소개 ↔ 이미지 관리) switches in place; otherwise navigate after the unsaved check.
    if (options.onSelect?.(tab)) return;
    if (!options.canLeave()) return;
    window.location.assign(paths[tab]);
  };
  return ([['home', '홈 화면'], ['church', '교회 소개'], ['images', '이미지 관리']] as const).map(([id, label]) => ({ id, label, active: id === current, onSelect: () => go(id), sections: id === current ? sections : [] }));
}
