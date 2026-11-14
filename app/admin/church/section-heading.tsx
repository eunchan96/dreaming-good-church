'use client';
import SaveButton from '../save-button';
import SiteIcon from '@/app/site-icon';
import styles from './workspace.module.css';
export default function SectionHeading({title,dirty,busy,onSave,onReload,saveLabel,reloadLabel}:{title:string;dirty:boolean;busy:boolean;onSave:()=>void;onReload:()=>void;saveLabel:string;reloadLabel:string}){
 return <div className={styles.heading}><div className={styles.headingTitle}><h2>{title}</h2></div><div className={styles.headingActions}><SaveButton className={dirty?styles.primary:undefined} aria-label={saveLabel} disabled={!dirty||busy} disabledHint={busy?'처리 중입니다.':'현재 최신 상태입니다.'} onClick={onSave}>저장</SaveButton><button type="button" className={styles.reload} aria-label={reloadLabel} title={reloadLabel} disabled={!dirty||busy} onClick={onReload}><SiteIcon name="refresh" size={18}/></button></div></div>;
}
