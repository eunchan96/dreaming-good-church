import PublicShell from '../public-shell';
import InstallGuide from '../install-guide';
import styles from '../public-site.module.css';
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('앱 추가', '휴대폰 홈 화면에 꿈꾸는좋은교회 앱을 추가하는 방법을 안내합니다.', '/install');
export default function Page() {
  return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}><header className={styles.pageHeading}><p className={styles.eyebrow}>WITH YOU, EVERY DAY</p><h1>앱 추가</h1><p>홈 화면에서 교회 소식을 편하게 열어 보세요.</p></header><InstallGuide /></main></PublicShell>;
}
