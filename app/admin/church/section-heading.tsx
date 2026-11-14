'use client';
import SiteIcon from '@/app/site-icon';
import styles from './workspace.module.css';
export default function SectionHeading({title,dirty,busy,onSave,onReload,saveLabel,reloadLabel}:{title:string;dirty:boolean;busy:boolean;onSave:()=>void;onReload:()=>void;saveLabel:string;reloadLabel:string}){
 return <div className={styles.heading}><div className={styles.headingTitle}><h2>{title}</h2><span className={styles.status}>{dirty?'수정 중':'최신 버전'}</span></div><div className={styles.headingActions}><button type="button" className={dirty?styles.primary:undefined} aria-label={saveLabel} disabled={!dirty||busy} onClick={onSave}>저장</button><button type="button" className={styles.reload} aria-label={reloadLabel} title={reloadLabel} disabled={!dirty||busy} onClick={onReload}><SiteIcon name="refresh" size={18}/></button></div></div>;
}
