'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import SiteIcon from '../site-icon';
import styles from './admin-shell.module.css';
const links = [
  { key:'home',href:'/admin/home',label:'홈페이지 관리' },
  { key:'worship',href:'/admin/worship',label:'예배 영상 관리' },
  { key:'bulletins',href:'/admin/bulletins',label:'주보 관리',description:'작성·검토·게시',icon:'book' as const },
  { key:'community',href:'/admin/community',label:'공지·일정 관리',description:'교회 소식과 모임',icon:'clock' as const },
  { key:'church',href:'/admin/church',label:'교회 정보·이미지 관리',description:'인사말·방문 안내·사진',icon:'pin' as const },
];
type ContentsSection={id:string;label:string};
type WorkspacePage={id:string;label:string;active:boolean;onSelect:()=>void;sections:ContentsSection[]};
function focusSection(id:string){
 const target=document.getElementById(id);if(!target||!target.getClientRects().length)return;
 target.focus({preventScroll:true});target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});history.replaceState(null,'','#'+id);
}
function PageContents({pages,busy}:{pages:WorkspacePage[];busy:boolean}){
 const [open,setOpen]=useState(()=>Object.fromEntries(pages.map(page=>[page.id,page.active])));
 const toggle=(id:string)=>setOpen(current=>({...current,[id]:!current[id]}));
 return pages.map(page=><div key={page.id} className={styles.pageGroup}><div className={styles.pageRow}><button className={styles.pageSelect} aria-current={page.active?'page':undefined} aria-expanded={!!open[page.id]} aria-controls={`toc-${page.id}`} disabled={busy} onClick={()=>{if(page.active)toggle(page.id);else page.onSelect();}}>{page.label}</button><button className={styles.pageToggle} aria-label={`${page.label} 목차 ${open[page.id]?'접기':'펼치기'}`} aria-expanded={!!open[page.id]} aria-controls={`toc-${page.id}`} onClick={()=>toggle(page.id)}><SiteIcon name="chevron" size={14}/></button></div><div id={`toc-${page.id}`} className={styles.pageSections} hidden={!open[page.id]}>{page.sections.map((section,index)=><a key={section.id} href={`#${section.id}`} onClick={e=>{e.preventDefault();if(busy)return;if(page.active)focusSection(section.id);else{page.onSelect();requestAnimationFrame(()=>focusSection(section.id));}}}><span className={styles.sectionNumber}>{String(index+1).padStart(2,'0')}</span>{section.label}</a>)}</div></div>);
}
export default function AdminShell({ children, intro, active, authenticated = false, canLeave = () => true, onLogout, busy = false, sections = [], pages = [] }: { children:ReactNode; intro?:ReactNode; active:'bulletins'|'community'|'church'|'account'|'worship'|'home'; authenticated?:boolean; canLeave?:()=>boolean; onLogout?:()=>void | Promise<void>; busy?:boolean; sections?:ContentsSection[]; pages?:WorkspacePage[] }) {
  const [menu,setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return <div className={styles.shell} data-auth={authenticated} onKeyDown={e=>{if(e.key==='Escape'&&menu){setMenu(false);menuButton.current?.focus();}}}>
    <a className={styles.skip} href="#admin-content">본문으로 바로가기</a>
    <header className={styles.header}><a href="/" target="_blank" rel="noreferrer" className={styles.brand} aria-label="꿈꾸는좋은교회 홈페이지 새 탭"><Image src="/brand/church-mark.svg" width={40} height={40} alt="" /><span><small>꿈꾸는</small><strong>좋은교회</strong></span></a>{authenticated ? <nav id="admin-navigation" className={styles.managementNav} data-open={menu} aria-label="관리 메뉴">{links.map(link=><Link key={link.key} href={link.href} aria-label={link.label} aria-current={active===link.key?'page':undefined} onClick={e=>{if(busy||!canLeave()){e.preventDefault();return;}setMenu(false);}}>{link.label}</Link>)}</nav> : <span className={styles.workspaceLabel}>CHURCH WORKSPACE</span>}<div className={styles.headerActions}><a href={active==='worship'?'/worship':active==='church'?'/church':active==='community'?'/notices':active==='bulletins'?'/bulletins':'/'} target="_blank" rel="noreferrer" aria-label="공개 화면 확인"><span>공개 화면 확인</span><SiteIcon name="diagonal" size={15} /></a>{onLogout ? <button onClick={() => void onLogout()} disabled={busy}>로그아웃</button> : null}{authenticated ? <button ref={menuButton} className={styles.menuToggle} aria-label={menu?'관리 메뉴 닫기':'관리 메뉴 열기'} aria-controls="admin-navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}><SiteIcon name={menu?'close':'menu'} size={22} /></button> : null}</div></header>
    {intro?<section aria-label="페이지 제목">{intro}</section>:null}
    <div className={styles.layout}>{authenticated ? <aside className={styles.sidebar} aria-label="빠른 이동"><nav aria-label="페이지 목차">{pages.length?<PageContents key={pages.find(page=>page.active)?.id??'none'} pages={pages} busy={busy}/>:<>{sections.map((section,index)=><a key={section.id} href={`#${section.id}`} onClick={e=>{const target=document.getElementById(section.id);if(!target)return;e.preventDefault();target.focus({preventScroll:true});target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});history.replaceState(null,'','#'+section.id);}}><span className={styles.sectionNumber}>{String(index+1).padStart(2,'0')}</span>{section.label}</a>)}</>}</nav></aside> : null}<div className={styles.content}>{children}</div></div>
    <footer className={styles.footer}><span>꿈꾸는좋은교회 · 관리 공간</span></footer>
  </div>;
}
