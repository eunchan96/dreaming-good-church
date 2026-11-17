import Link from 'next/link';
import PublicShell from './public-shell';
import HomeHeroReader from './home-hero-reader';
import HomeUpdates from './home-updates';
import WorshipVideo from './worship-video';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';
export default function Home() {
  return <PublicShell><main id="public-content" tabIndex={-1}>
    <HomeHeroReader/>
    <section id="home-worship" className={styles.homeSection} aria-labelledby="home-worship-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / WORSHIP</p><h2 id="home-worship-title">말씀으로 여는<br /><span>한 주의 시작.</span></h2></div><div><p>예배의 자리에 함께하지 못해도,<br />말씀의 은혜는 우리의 일상으로 이어집니다.</p><Link className={styles.textLink} href="/worship">예배 영상 더 보기<SiteIcon /></Link></div></div><WorshipVideo compact /></section>
    <section className={styles.welcomeSection} aria-labelledby="first-visit-title"><div className={styles.welcomeInner}><div><p className={styles.eyebrow}>02 / WELCOME</p><h2 id="first-visit-title">처음 오셨나요?<br /><em>반갑습니다.</em></h2><p>예배의 자리에서 만날 당신을 기다립니다.<br />편안한 마음으로 찾아오세요.</p></div><div className={styles.welcomeLinks}>{[{ href: '/church', label: '교회 소개', text: '우리가 함께 꿈꾸는 교회', icon: 'book' },{ href: '/church/worship-times', label: '예배시간 안내', text: '함께 모여 예배하는 시간', icon: 'clock' },{ href: '/church/directions', label: '오시는 길', text: '꿈꾸는좋은교회를 찾아오시는 길', icon: 'pin' }].map(item => <Link href={item.href} key={item.href}><SiteIcon name={item.icon as 'book' | 'clock' | 'pin'} size={25} /><div><h3>{item.label}</h3><p>{item.text}</p></div><SiteIcon /></Link>)}</div></div></section>
    <section className={styles.homeSection} aria-labelledby="home-news-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / OUR COMMUNITY</p><h2 id="home-news-title">함께 나누는<br /><span>교회의 일상.</span></h2></div><p>이번 주의 주보와 새로운 소식을 만나보세요.</p></div><HomeUpdates /></section>
    <section className={styles.homeInvitation}><p>함께 드리는 예배, 함께 걸어가는 믿음.</p><h2>이번 주일,<br className={styles.mobileBreak} /> 우리 함께 예배해요.</h2><Link className={styles.primary} href="/church/worship-times">예배시간 알아보기<SiteIcon /></Link></section>
  </main></PublicShell>;
}
