import type { CSSProperties } from 'react';
const paths = {
  arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
  diagonal: <><path d="M5 19 19 5M5 5h14v14" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M6 18 18 6" /></>,
  play: <path d="m9 5 11 7-11 7Z" />,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  book: <><path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z" /></>,
  youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3Z" /></>,
  phone: <path d="m5 3 4 1 1 5-3 2c2 3 3 4 6 6l2-3 5 1 1 4c0 4-7 3-12-2S1 3 5 3Z" />,
};
export default function SiteIcon({ name = 'arrow', size = 20, style }: { name?: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0, ...style }}>{paths[name]}</svg>;
}
