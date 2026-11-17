'use client';
import Link from 'next/link';
import {CHURCH_ADDRESS} from '@/lib/site-content';
import {formatWorshipTime} from '@/lib/church-page-settings';
import {useChurchContent,publicChurchField} from './church-content';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';

// First-visit links show the real Sunday time and address instead of generic copy.
export default function HomeWelcome(){
 const {fields,fieldsFailed,settings,settingsStatus}=useChurchContent();
 const sunday=settings.worship_times.find(row=>row.key==='sunday');
 const time=settingsStatus==='ready'&&sunday?`주일예배 ${formatWorshipTime(sunday)}`:'함께 모여 예배하는 시간';
 const address=(fieldsFailed?null:publicChurchField(fields,'address',CHURCH_ADDRESS)?.replace('선인빌딩','선아빌딩'))||'꿈꾸는좋은교회를 찾아오시는 길';
 const links=[{href:'/church',label:'교회 소개',text:'우리가 함께 꿈꾸는 교회',icon:'book'},{href:'/church/worship-times',label:'예배시간 안내',text:time,icon:'clock'},{href:'/church/directions',label:'오시는 길',text:address,icon:'pin'}] as const;
 return <section className={styles.welcomeSection} aria-labelledby="first-visit-title"><div className={styles.welcomeInner}>
  <div><p className={styles.eyebrow}>02 / WELCOME</p><h2 id="first-visit-title">처음 오셨나요?<br/><em>반갑습니다.</em></h2><p>예배의 자리에서 만날 당신을 기다립니다.<br/>편안한 마음으로 찾아오세요.</p></div>
  <div className={styles.welcomeLinks}>{links.map(item=><Link href={item.href} key={item.href}><SiteIcon name={item.icon} size={25}/><div><h3>{item.label}</h3><p>{item.text}</p></div><SiteIcon/></Link>)}</div>
 </div></section>;
}
