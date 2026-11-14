'use client';
import styles from './workspace.module.css';
export default function SectionHeading({title,dirty,busy,onSave,onReload,saveLabel,reloadLabel}:{title:string;dirty:boolean;busy:boolean;onSave:()=>void;onReload:()=>void;saveLabel:string;reloadLabel:string}){
 return <div className={styles.heading}><h2>{title}</h2><div className={styles.headingActions}><span className={styles.status}>{dirty?'수정 중':'최신 버전'}</span><button type="button" className={dirty?styles.primary:undefined} aria-label={saveLabel} disabled={!dirty||busy} onClick={onSave}>저장</button><button type="button" className={styles.reload} aria-label={reloadLabel} disabled={!dirty||busy} onClick={onReload}>다시 불러오기</button></div></div>;
}
