import PublicShell from '../public-shell';
import InstallGuide from '../install-guide';
import styles from '../public-site.module.css';
export const metadata = { title: '앱 추가 | 꿈꾸는좋은교회' };
export default function Page() {
  return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}><header className={styles.pageHeading}><p className={styles.eyebrow}>WITH YOU, EVERY DAY</p><h1>앱 추가</h1><p>홈 화면에서 교회 소식을 편하게 열어 보세요.</p></header><InstallGuide /></main></PublicShell>;
}
