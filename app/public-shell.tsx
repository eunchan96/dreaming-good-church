'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CHURCH_ADDRESS, CHURCH_PHONE, siteNavigation, YOUTUBE_CHANNEL } from '@/lib/site-content';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';
import { rememberInstallPrompt, clearInstallPrompt } from '@/lib/install-prompt';
export function ChurchBrand() {
  return <><Image src="/brand/church-mark.svg" width={46} height={46} alt="" /><span className={styles.brandText}><span>꿈꾸는</span><strong>좋은교회</strong></span></>;
}
export default function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null), [mobile, setMobile] = useState(false);
  const header = useRef<HTMLElement>(null);
  const close = () => { setOpen(null); setMobile(false); };
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', rememberInstallPrompt); window.addEventListener('appinstalled', clearInstallPrompt);
    const dismiss = (e: PointerEvent) => { if (!header.current?.contains(e.target as Node)) close(); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { const trigger = header.current?.querySelector('[aria-expanded="true"]') as HTMLElement | null; close(); trigger?.focus(); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); window.removeEventListener('beforeinstallprompt', rememberInstallPrompt); window.removeEventListener('appinstalled', clearInstallPrompt); };
  }, []);
  return <div className={styles.site}><a className={styles.skip} href="#public-content">본문으로 바로가기</a>
    <header ref={header} className={styles.header} onPointerLeave={e => { if (e.pointerType === 'mouse') setOpen(null); }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand} aria-label="꿈꾸는좋은교회 홈" onClick={close}><ChurchBrand /></Link>
      <nav className={styles.desktopNav} aria-label="주 메뉴">{siteNavigation.map((group, index) => <div className={styles.navGroup} key={group.name} onPointerEnter={e => { if (e.pointerType === 'mouse') setOpen(group.name); }} onPointerLeave={e => { if (e.pointerType === 'mouse') setOpen(null); }}><Link href={group.href} aria-expanded={open === group.name} aria-controls={`desktop-menu-${index}`} onFocus={() => setOpen(group.name)} onClick={close}>{group.name}</Link><div id={`desktop-menu-${index}`} className={styles.dropdown} inert={open !== group.name} data-open={open === group.name}>{group.links.map(link => <Link key={link.href} href={link.href} onClick={close} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</div></div>)}</nav>
      <div className={styles.headerActions}><a className={styles.youtubeLink} href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer" aria-label="교회 YouTube 채널"><SiteIcon name="youtube" size={22} /><span>YouTube</span></a><button data-menu-trigger className={styles.mobileMenuButton} aria-label={mobile ? '메뉴 닫기' : '전체 메뉴 열기'} aria-expanded={mobile} aria-controls="mobile-site-menu" onClick={() => setMobile(!mobile)}><SiteIcon name={mobile ? 'close' : 'menu'} size={25} /></button></div>
    </div><nav id="mobile-site-menu" className={styles.mobileMenu} aria-label="모바일 주 메뉴" hidden={!mobile}>{siteNavigation.map(group => <div key={group.name}><Link className={styles.mobileGroupTitle} href={group.href} onClick={close}>{group.name}</Link><div className={styles.mobileSublinks}>{group.links.map(link => <Link key={link.href} href={link.href} onClick={close} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</div></div>)}</nav></header>
    {children}
    <footer className={styles.footer}><div className={styles.footerTop}><div className={styles.footerIdentity}><Link href="/" className={styles.brand}><ChurchBrand /></Link><a className={styles.footerYoutube} href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer"><SiteIcon name="youtube" />YouTube<SiteIcon name="diagonal" size={16} /></a></div><nav className={styles.footerNavigation} aria-label="하단 메뉴">{[{ label: '교회 소개', href: '/church' }, { label: '온라인 헌금', href: '/church/offering' }, { label: '예배', href: '/worship' }, { label: '소식', href: '/notices' }, { label: '앱 추가', href: '/install' }].map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav><div className={styles.footerContact}><span>꿈꾸는좋은교회</span><address>{CHURCH_ADDRESS}</address><a href={`tel:${CHURCH_PHONE.replaceAll('-', '')}`}>T. {CHURCH_PHONE}</a></div></div>
      <div className={styles.footerBottom}><small>© 2026 꿈꾸는좋은교회. All rights reserved.</small><div className={styles.footerUtilities}><a href="#top" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>맨 위로<SiteIcon size={14} style={{ transform: 'rotate(-90deg)' }} /></a><Link href="/admin/bulletins">로그인</Link></div></div>
    </footer>
  </div>;
}
