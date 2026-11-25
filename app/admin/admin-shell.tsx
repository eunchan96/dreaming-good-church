'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { rememberSignedIn, useRememberedSignIn } from './admin-session';
import AdminInvitation from './admin-invitation';
import { ChurchBrand } from '../public-shell';
import SiteIcon from '../site-icon';
import styles from './admin-shell.module.css';

const links = [
  { key: 'home', href: '/admin/home', label: '홈페이지 관리' },
  { key: 'worship', href: '/admin/worship', label: '예배 영상 관리' },
  { key: 'bulletins', href: '/admin/bulletins', label: '주보 관리' },
  { key: 'community', href: '/admin/community', label: '공지·일정 관리' },
];
const publicPaths: Record<string, string> = { worship: '/worship', church: '/church', community: '/notices', bulletins: '/bulletins' };

/** A quick-jump target. `group` starts a labelled block in the sidebar (e.g. 예배 순서). */
type ContentsSection = { id: string; label: string; group?: string };
type WorkspacePage = { id: string; label: string; active: boolean; onSelect: () => void; sections: ContentsSection[] };

function focusSection(id: string) {
  const target = document.getElementById(id);
  if (!target || !target.getClientRects().length) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#' + id);
}

function SectionLinks({ sections, onPick }: { sections: ContentsSection[]; onPick: (id: string, event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <>{sections.map(section => <a key={section.id} href={`#${section.id}`} data-child={section.group ? true : undefined} onClick={event => onPick(section.id, event)}>{section.label}</a>)}</>;
}

function TocLinks({ toc, onPick }: { toc: ContentsSection[]; onPick: (id: string, event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <>{toc.map((section, index) => <div key={section.id} className={styles.tocItem}>
    {section.group && section.group !== toc[index - 1]?.group ? <p className={styles.tocGroup}>{section.group}</p> : null}
    <SectionLinks sections={[section]} onPick={onPick} />
  </div>)}</>;
}

export default function AdminShell({ children, intro, active, authenticated = false, canLeave = () => true, onLogout, busy = false, sections = [], pages = [] }: { children: ReactNode; intro?: ReactNode; active: 'bulletins' | 'community' | 'church' | 'account' | 'worship' | 'home' | 'guide'; authenticated?: boolean; canLeave?: () => boolean | Promise<boolean>; onLogout?: () => void | Promise<void>; busy?: boolean; sections?: ContentsSection[]; pages?: WorkspacePage[] }) {
  const [menu, setMenu] = useState(false);
  // Animate only menus the user opens or closes, not ones that appear or vanish when the window width crosses the mobile breakpoint.
  const [menuMotion, setMenuMotion] = useState(false);
  const router = useRouter();
  // While a page re-checks the session, keep the menu if this tab was already signed in (display only).
  const remembered = useRememberedSignIn(), signedIn = authenticated || remembered;
  useEffect(() => { if (authenticated) rememberSignedIn(); }, [authenticated]);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activePage = pages.find(page => page.active);
  const toc = activePage ? activePage.sections : sections;
  const [tocOpen, setTocOpen] = useState(false);
  const pick = (id: string, event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); setTocOpen(false); if (!busy) focusSection(id); };
  return <div className={styles.shell} data-auth={authenticated} onKeyDown={e => { if (e.key !== 'Escape') return; setTocOpen(false); if (menu) { setMenu(false); menuButton.current?.focus(); } }}>
    <a className={styles.skip} href="#admin-content">본문으로 바로가기</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <a href="/" target="_blank" rel="noreferrer" className={styles.brand} title="홈페이지 새 탭에서 열기"><ChurchBrand /><span className={styles.badge}>관리</span></a>
      {signedIn ? <nav id="admin-navigation" className={styles.managementNav} data-open={menu} data-motion={menuMotion || undefined} onTransitionEnd={e => { if (e.target === e.currentTarget && !menu) setMenuMotion(false); }} aria-label="관리 메뉴">
        {links.map(link => <Link key={link.key} href={link.href} aria-current={active === link.key || (link.key === 'home' && active === 'church') ? 'page' : undefined} onClick={e => { if (busy) { e.preventDefault(); return; } const answer = canLeave(); if (answer === true) { setMenu(false); return; } e.preventDefault(); void Promise.resolve(answer).then(ok => { if (ok) { setMenu(false); router.push(link.href); } }); }}>{link.label}</Link>)}
      </nav> : null}
      <div className={styles.headerActions}>
        {/* 쓰던 내용을 잃지 않게 사용 안내는 새 탭으로 연다. */}
        {active !== 'guide' ? <a href="/admin/guide" target="_blank" rel="noreferrer" aria-label="사용 안내 (새 탭)"><SiteIcon name="book" size={15} /><span>사용 안내</span></a> : null}
        <a href={publicPaths[active] ?? '/'} target="_blank" rel="noreferrer" aria-label="공개 화면 확인"><span>공개 화면 확인</span><SiteIcon name="diagonal" size={14} /></a>
        {signedIn ? <button type="button" ref={menuButton} className={styles.menuToggle} aria-label={menu ? '관리 메뉴 닫기' : '관리 메뉴 열기'} aria-controls="admin-navigation" aria-expanded={menu} onClick={() => { setMenuMotion(true); setMenu(!menu); }}><SiteIcon name={menu ? 'close' : 'menu'} size={24} /></button> : null}
      </div>
    </div></header>
    {intro ? <section aria-label="페이지 제목" className={styles.titleBar}>{intro}</section> : null}
    {signedIn && (pages.length || toc.length > 1) ? <nav className={styles.tabs} aria-label="페이지 메뉴">
      {(pages.length ? pages : [{ id: 'contents', label: '목차', active: true, onSelect: () => {}, sections }]).map(page => {
        const menu = page.active && toc.length > 1;
        return <div key={page.id} className={styles.tabItem} data-menu={menu} data-virtual={!pages.length} data-open={menu && tocOpen} onMouseLeave={() => setTocOpen(false)}>
          <button type="button" aria-current={page.active && pages.length ? 'page' : undefined} aria-expanded={menu ? tocOpen : undefined} aria-controls={menu ? 'admin-toc-menu' : undefined} disabled={busy} onClick={() => { if (!page.active) page.onSelect(); else if (menu) setTocOpen(!tocOpen); }}>{page.label}{menu ? <SiteIcon name="chevron" size={12} /> : null}</button>
          {menu ? <nav id="admin-toc-menu" className={styles.tocMenu} aria-label="빠른 이동 선택"><TocLinks toc={toc} onPick={pick} /></nav> : null}
        </div>;
      })}
    </nav> : null}
    <div className={styles.layout} data-sidebar={authenticated && toc.length > 1}>
      {authenticated && toc.length > 1 ? <aside className={styles.sidebar} aria-label="빠른 이동">
        <nav className={styles.desktopContents} aria-label="페이지 목차"><TocLinks toc={toc} onPick={pick} /></nav>
      </aside> : null}
      <div className={styles.content}>{children}</div>
    </div>
    {authenticated || onLogout ? <footer className={styles.footer} aria-label="관리자 계정">
      <div className={styles.footerInner}>
        <a href="/" target="_blank" rel="noreferrer" className={styles.footerBrand}>
          <ChurchBrand onDark /><span className={styles.srOnly}> 홈페이지 새 탭에서 열기</span>
        </a>
        <div className={styles.footerActions}>
          {authenticated ? <AdminInvitation disabled={busy} /> : null}
          {onLogout ? <button type="button" onClick={() => void onLogout()} disabled={busy}>로그아웃</button> : null}
        </div>
      </div>
    </footer> : null}
  </div>;
}
