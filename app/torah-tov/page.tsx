import PublicShell from '../public-shell';
import NewsNavigation from '../news-navigation';
import BulletinSections from '../bulletin-sections';
import styles from '../public-site.module.css';
export const metadata = { title: '토라&토브 | 꿈꾸는좋은교회' };
export default function Page() { return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}><header className={styles.pageHeading}><p className={styles.eyebrow}>TORAH & TOV</p><h1>토라&amp;토브</h1><p>말씀을 묵상하고 암송하며, 한 주의 삶에 새깁니다.</p></header><NewsNavigation /><BulletinSections section="torah-tov" /></main></PublicShell>; }
