import Link from "next/link";
import PublicShell from "./public-shell";
import HomeUpdates from "./home-updates";
import styles from "./public-site.module.css";

export default function Home() {
  return <PublicShell><main id="public-content" tabIndex={-1} className={styles.home}>
    <section className={styles.hero} aria-labelledby="welcome-title">
      <div><p className={styles.eyebrow}>꿈꾸는좋은교회</p>
        <h1 id="welcome-title">함께 예배하는 기쁨,<br />함께 나누는 일상.</h1>
        <p>꿈꾸는좋은교회에 오신 여러분을 환영합니다.</p>
        <div className={styles.actions}><Link className={styles.primary} href="/bulletins">이번 주 주보 읽기 <span aria-hidden="true">↗</span></Link><Link className={styles.secondary} href="/church">예배 시간 · 오시는 길</Link></div>
      </div>
      <aside className={styles.welcome}><span aria-hidden="true">＋</span><p>처음 오셨나요?</p><h2>반갑습니다.<br />함께 예배해요.</h2><Link href="/church">교회 안내 살펴보기 →</Link></aside>
    </section>
    <HomeUpdates />
  </main></PublicShell>;
}
