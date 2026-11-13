'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import SiteIcon from '../site-icon';
import styles from './admin-shell.module.css';
const links = [
  { key:'bulletins',href:'/admin/bulletins',label:'주보 관리',description:'작성·검토·게시',icon:'book' as const },
  { key:'community',href:'/admin/community',label:'공지·일정 관리',description:'교회 소식과 모임',icon:'clock' as const },
  { key:'church',href:'/admin/church',label:'교회 정보·이미지 관리',description:'인사말·방문 안내·사진',icon:'pin' as const },
];
export default function AdminShell({ children, active, authenticated = false, canLeave = () => true, onLogout, busy = false }: { children:ReactNode; active:'bulletins'|'community'|'church'|'account'; authenticated?:boolean; canLeave?:()=>boolean; onLogout?:()=>void | Promise<void>; busy?:boolean }) {
  const [menu,setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return <div className={styles.shell} data-auth={authenticated} onKeyDown={e=>{if(e.key==='Escape'&&menu){setMenu(false);menuButton.current?.focus();}}}>
    <a className={styles.skip} href="#admin-content">본문으로 바로가기</a>
    <header className={styles.header}><a href="/" target="_blank" rel="noreferrer" className={styles.brand} aria-label="꿈꾸는좋은교회 홈페이지 새 탭"><Image src="/brand/church-mark.svg" width={40} height={40} alt="" /><span><small>꿈꾸는</small><strong>좋은교회</strong></span></a><span className={styles.workspaceLabel}>CHURCH WORKSPACE</span><div className={styles.headerActions}><a href="/" target="_blank" rel="noreferrer">홈페이지 보기<SiteIcon name="diagonal" size={15} /></a>{onLogout ? <button onClick={() => void onLogout()} disabled={busy}>로그아웃</button> : null}{authenticated ? <button ref={menuButton} className={styles.menuToggle} aria-label={menu?'관리 메뉴 닫기':'관리 메뉴 열기'} aria-controls="admin-navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}><SiteIcon name={menu?'close':'menu'} size={22} /></button> : null}</div></header>
    <div className={styles.layout}>{authenticated ? <aside className={styles.sidebar} data-open={menu}><p className={styles.menuLabel}>콘텐츠 관리</p><nav id="admin-navigation" aria-label="관리 메뉴">{links.map(link=><Link key={link.key} href={link.href} aria-label={link.label} aria-current={active===link.key?'page':undefined} onClick={e=>{if(!canLeave()){e.preventDefault();return;}setMenu(false);}}><SiteIcon name={link.icon} size={20}/><span><strong>{link.label}</strong><small>{link.description}</small></span></Link>)}</nav><div className={styles.sidebarNote}><span>함께 준비하는 주일</span><p>초안을 저장하고 공개할 내용을 확인한 뒤 게시해 주세요.</p></div></aside> : null}<div className={styles.content}>{children}</div></div>
    <footer className={styles.footer}><span>꿈꾸는좋은교회 · 관리 공간</span><a href="/" target="_blank" rel="noreferrer">공개 홈페이지<SiteIcon name="diagonal" size={13}/></a></footer>
  </div>;
}
