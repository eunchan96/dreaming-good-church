import PublicShell from '../public-shell';
import NewsNavigation from '../news-navigation';
import TorahReader from './torah-reader';
import styles from '../public-site.module.css';
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('토라&토브', '말씀을 묵상하고 암송하며 한 주의 삶에 새기는 꿈꾸는좋은교회 토라&토브입니다.', '/torah-tov');
export default function Page() { return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}><header className={styles.pageHeading}><p className={styles.eyebrow}>TORAH & TOV</p><h1>토라&amp;토브</h1><p>말씀을 묵상하고 암송하며, 한 주의 삶에 새깁니다.</p></header><NewsNavigation /><div className={styles.newsBody}><TorahReader /></div></main></PublicShell>; }
