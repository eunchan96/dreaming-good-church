'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './bulletins/workspace.module.css';
export default function InfoTip({ label, children }: {label:string;children:ReactNode}) {
  const root=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    function close(e:PointerEvent){if(!root.current?.contains(e.target as Node))root.current?.removeAttribute('open');}
    const dismiss=()=>root.current?.removeAttribute('open');
    document.addEventListener('pointerdown',close);window.addEventListener('scroll',dismiss);window.addEventListener('resize',dismiss);return()=>{document.removeEventListener('pointerdown',close);window.removeEventListener('scroll',dismiss);window.removeEventListener('resize',dismiss);};
  },[]);
  return <details ref={root} className={styles.infoTip} onToggle={()=>{if(!root.current?.open)return;const panel=root.current.querySelector('[data-tip-panel]') as HTMLElement|null;if(!panel)return;const rect=root.current.getBoundingClientRect();const width=Math.min(320,innerWidth-44);panel.style.left=`${Math.max(22,Math.min(rect.left,innerWidth-width-22))}px`;panel.style.top=`${Math.max(16,Math.min(rect.bottom+5,innerHeight-panel.offsetHeight-16))}px`;}} onKeyDown={e=>{if(e.key==='Escape'){root.current?.removeAttribute('open');root.current?.querySelector('summary')?.focus();}}}><summary aria-label={`${label} 도움말`}>i</summary><div data-tip-panel className={styles.infoBody}>{children}</div></details>;
}
