import Link from 'next/link';
import PublicShell from './public-shell';
import HomeHeroReader from './home-hero-reader';
import HomeUpdates from './home-updates';
import HomeWelcome from './home-welcome';
import WorshipVideo from './worship-video';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';
export default function Home() {
  return <PublicShell><main id="public-content" tabIndex={-1}>
    <HomeHeroReader/>
    <section id="home-worship" className={styles.homeSection} aria-labelledby="home-worship-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / WORSHIP</p><h2 id="home-worship-title">말씀으로 여는<br /><span>한 주의 시작.</span></h2></div><div><p>예배의 자리에 함께하지 못해도,<br />말씀의 은혜는 우리의 일상으로 이어집니다.</p><Link className={styles.textLink} href="/worship">예배 영상 더 보기<SiteIcon /></Link></div></div><WorshipVideo compact /></section>
    <HomeWelcome/>
    <section className={styles.newsSection} aria-labelledby="home-news-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / OUR COMMUNITY</p><h2 id="home-news-title">이번 주<br /><em>교회 소식.</em></h2></div><p>주보와 새로운 소식,<br />다가오는 일정을 만나보세요.</p></div><HomeUpdates /></section>
  </main></PublicShell>;
}
