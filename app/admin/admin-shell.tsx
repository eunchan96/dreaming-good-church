'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import SiteIcon from '../site-icon';
import styles from './admin-shell.module.css';

const links = [
  { key: 'home', href: '/admin/home', label: '홈페이지 관리' },
  { key: 'worship', href: '/admin/worship', label: '예배 영상 관리' },
  { key: 'bulletins', href: '/admin/bulletins', label: '주보 관리' },
  { key: 'community', href: '/admin/community', label: '공지·일정 관리' },
  { key: 'church', href: '/admin/church', label: '교회 정보·이미지 관리' },
];
const publicPaths: Record<string, string> = { worship: '/worship', church: '/church', community: '/notices', bulletins: '/bulletins' };

type ContentsSection = { id: string; label: string };
type WorkspacePage = { id: string; label: string; active: boolean; onSelect: () => void; sections: ContentsSection[] };

function focusSection(id: string) {
  const target = document.getElementById(id);
  if (!target || !target.getClientRects().length) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#' + id);
}

function SectionLinks({ sections, onPick }: { sections: ContentsSection[]; onPick: (id: string, event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <>{sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={event => onPick(section.id, event)}>{section.label}</a>)}</>;
}

/** Flat sidebar: every page is one row; only the active page lists its sections underneath. */
function PageContents({ pages, busy }: { pages: WorkspacePage[]; busy: boolean }) {
  return pages.map(page => <div key={page.id} className={styles.pageGroup}>
    <div className={styles.pageRow}><button type="button" className={styles.pageSelect} aria-current={page.active ? 'page' : undefined} aria-expanded={page.sections.length ? page.active : undefined} aria-controls={page.active && page.sections.length ? `toc-${page.id}` : undefined} disabled={busy} onClick={() => { if (!page.active) page.onSelect(); }}>{page.label}</button></div>
    {page.active && page.sections.length ? <div id={`toc-${page.id}`} className={styles.pageSections}>
      <SectionLinks sections={page.sections} onPick={(id, event) => { event.preventDefault(); if (!busy) focusSection(id); }} />
    </div> : null}
  </div>);
}

export default function AdminShell({ children, intro, active, authenticated = false, canLeave = () => true, onLogout, busy = false, sections = [], pages = [] }: { children: ReactNode; intro?: ReactNode; active: 'bulletins' | 'community' | 'church' | 'account' | 'worship' | 'home'; authenticated?: boolean; canLeave?: () => boolean; onLogout?: () => void | Promise<void>; busy?: boolean; sections?: ContentsSection[]; pages?: WorkspacePage[] }) {
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const activePage = pages.find(page => page.active);
  const closeDetails = (node: HTMLElement) => node.closest('details')?.removeAttribute('open');
  return <div className={styles.shell} data-auth={authenticated} onKeyDown={e => { if (e.key === 'Escape' && menu) { setMenu(false); menuButton.current?.focus(); } }}>
    <a className={styles.skip} href="#admin-content">본문으로 바로가기</a>
    <header className={styles.header}>
      <a href="/" target="_blank" rel="noreferrer" className={styles.brand} title="홈페이지 새 탭에서 열기">
        <Image src="/brand/church-mark.svg" width={30} height={30} alt="" />
        <strong>좋은교회</strong><span>관리</span>
      </a>
      {authenticated ? <nav id="admin-navigation" className={styles.managementNav} data-open={menu} aria-label="관리 메뉴">
        {links.map(link => <Link key={link.key} href={link.href} aria-current={active === link.key ? 'page' : undefined} onClick={e => { if (busy || !canLeave()) { e.preventDefault(); return; } setMenu(false); }}>{link.label}</Link>)}
      </nav> : null}
      <div className={styles.headerActions}>
        <a href={publicPaths[active] ?? '/'} target="_blank" rel="noreferrer" aria-label="공개 화면 확인"><span>공개 화면 확인</span><SiteIcon name="diagonal" size={14} /></a>
        {onLogout ? <button type="button" onClick={() => void onLogout()} disabled={busy}>로그아웃</button> : null}
        {authenticated ? <button type="button" ref={menuButton} className={styles.menuToggle} aria-label={menu ? '관리 메뉴 닫기' : '관리 메뉴 열기'} aria-controls="admin-navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><SiteIcon name={menu ? 'close' : 'menu'} size={20} /></button> : null}
      </div>
    </header>
    {intro ? <section aria-label="페이지 제목" className={styles.titleBar}>{intro}</section> : null}
    <div className={styles.layout} data-sidebar={authenticated && (pages.length > 0 || sections.length > 0)}>
      {authenticated && (pages.length || sections.length) ? <aside className={styles.sidebar} aria-label="빠른 이동">
        <nav className={styles.desktopContents} aria-label="페이지 목차">
          {pages.length ? <PageContents pages={pages} busy={busy} /> : <SectionLinks sections={sections} onPick={(id, event) => { event.preventDefault(); focusSection(id); }} />}
        </nav>
        <details className={styles.mobileContents}>
          <summary>빠른 이동 <span>{activePage?.label ?? '목차'}</span></summary>
          <nav aria-label="빠른 이동 선택">
            {pages.length ? pages.map(page => <div key={page.id}>
              <button type="button" disabled={busy} aria-current={page.active ? 'page' : undefined} onClick={e => { if (!page.active) page.onSelect(); closeDetails(e.currentTarget); }}>{page.label}</button>
              {page.active ? <SectionLinks sections={page.sections} onPick={(id, event) => { event.preventDefault(); closeDetails(event.currentTarget); focusSection(id); }} /> : null}
            </div>) : <SectionLinks sections={sections} onPick={(id, event) => { event.preventDefault(); closeDetails(event.currentTarget); focusSection(id); }} />}
          </nav>
        </details>
      </aside> : null}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  </div>;
}
