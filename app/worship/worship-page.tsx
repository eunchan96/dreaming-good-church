import Link from 'next/link';
import { worshipTypes, type WorshipType } from '@/lib/site-content';
import PublicShell from '../public-shell';
import WorshipVideo from '../worship-video';
import WorshipTimes from '../worship-times';
import styles from '../public-site.module.css';
export default function WorshipPage({ type = 'sunday' }: { type?: WorshipType }) {
  const selected = worshipTypes.find(w => w.key === type)!;
  return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}><header className={styles.pageHeading}><p className={styles.eyebrow}>WORSHIP & WORD</p><h1>예배</h1><p>말씀 안에서 함께 자라가는 시간, 예배의 은혜를 나눕니다.</p></header><nav className={styles.subnav} aria-label="예배 종류">{worshipTypes.map(w => <Link key={w.key} href={w.key === 'sunday' ? '/worship' : `/worship/${w.key}`} aria-current={w.key === type ? 'page' : undefined}>{w.name}</Link>)}</nav><h2 className={styles.eyebrow}>{selected.english} · {selected.name}</h2><WorshipVideo type={type} /><WorshipTimes /></main></PublicShell>;
}
