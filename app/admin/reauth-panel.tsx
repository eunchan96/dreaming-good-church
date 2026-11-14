'use client';
import Link from 'next/link';
import {useId} from 'react';
import SiteIcon from '../site-icon';
import styles from './bulletins/workspace.module.css';
export default function ReauthPanel({message,hasDraft=false,onRetry}:{message:string;hasDraft?:boolean;onRetry:()=>void}){
 const title=useId(),checking=message.includes('확인하고 있습니다'),unavailable=message.includes('DB 적용');
 return <section className={styles.reauthPanel} aria-labelledby={title}><div className={styles.reauthIcon} aria-hidden="true"><SiteIcon name="book" size={25}/></div><p className={styles.eyebrow}>ADMINISTRATOR ACCESS</p><h2 id={title}>{checking?'로그인 상태를 확인하고 있어요':unavailable?'관리 화면을 준비하고 있습니다':hasDraft?'작성하던 내용을 이어가세요':'관리자 로그인을 확인해 주세요'}</h2><p role="status" className={styles.reauthDescription}>{checking?'잠시만 기다려 주세요.':unavailable?message:hasDraft?'입력한 내용은 현재 탭에 유지됩니다. 같은 관리자 계정으로 다시 로그인해 주세요.':'관리자 권한이 있는 계정으로 로그인한 뒤 이 화면으로 돌아와 주세요.'}</p><div className={styles.reauthActions}><Link href="/admin/bulletins" target="_blank" rel="noopener noreferrer" aria-label="새 탭에서 관리자 로그인">관리자 로그인<SiteIcon name="diagonal" size={17}/></Link><button disabled={checking} onClick={onRetry}>{checking?'확인 중…':'로그인 다시 확인'}</button></div><p className={styles.reauthNote}>{hasDraft?'작성 중인 탭은 닫지 마세요. 미저장 내용은 이 탭에만 보관됩니다.':'로그인은 새 탭에서 열립니다. 완료하면 이 화면으로 돌아오세요.'}</p></section>;
}
