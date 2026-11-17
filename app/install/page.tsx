import PublicShell from '../public-shell';
import InstallGuide from '../install-guide';
import styles from '../public-site.module.css';
export const metadata = { title: '앱 추가 | 꿈꾸는좋은교회' };
export default function Page() {
  return <PublicShell><main id="public-content" tabIndex={-1} className={styles.subpage}><header className={styles.pageHeading}><p className={styles.eyebrow}>WITH YOU, EVERY DAY</p><h1>앱 추가</h1><p>홈 화면에서 교회 소식을 편하게 열고, 저장한 공개 내용을 오프라인에서도 만나세요.</p></header><div className={styles.prose}><h2>홈 화면에 추가 · 설치 안내</h2><InstallGuide /></div></main></PublicShell>;
}
