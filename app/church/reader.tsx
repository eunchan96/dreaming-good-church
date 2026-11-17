'use client';
import Image from 'next/image';
import Link from 'next/link';
import { CHURCH_ADDRESS, CHURCH_PHONE, siteNavigation } from '@/lib/site-content';
import {useChurchContent,publicChurchField} from '../church-content';
import SiteIcon from '../site-icon';
import WorshipTimes from '../worship-times';
import { Greeting, Offering } from './church-sections';
import { churchCopyDefaults } from '@/lib/church-copy';
import css from './church.module.css';
import styles from '../public-site.module.css';
type Section = 'greeting' | 'directions' | 'worship-times' | 'offering';
export default function ChurchReader({ section = 'greeting' }: { section?: Section }) {
  const {fields,settings,portrait,fieldsFailed:failed,settingsStatus,retry}=useChurchContent();
  const address = failed?null:publicChurchField(fields,'address',CHURCH_ADDRESS)?.replace('선인빌딩','선아빌딩');
  const phone = failed?null:publicChurchField(fields,'phone',CHURCH_PHONE);
  // Editable wording falls back to the default copy while loading or when left empty.
  const copy=(key:string)=>publicChurchField(fields,key,churchCopyDefaults[key])??churchCopyDefaults[key];
  const pastor=fields?.pastor_name?.trim()||null;
  const worshipNote=fields?.worship?.trim()||null;
  const location=settings.location;
  const mapQuery=`${location.latitude},${location.longitude}`;
  return <main id="public-content" tabIndex={-1} className={styles.subpage}>
    <header className={styles.pageHeading}><p className={styles.eyebrow}>ABOUT OUR CHURCH</p><h1>교회 소개</h1><p>{copy('page_lead')}</p></header>
    <nav className={styles.subnav} aria-label="교회 소개 메뉴">{siteNavigation[0].links.map(link => <Link key={link.href} href={link.href} aria-current={(section === 'greeting' ? '/church' : `/church/${section}`) === link.href ? 'page' : undefined}>{link.label}</Link>)}</nav>
    {failed ? <div className={styles.unconfirmed}><p role="status">등록된 교회 안내를 불러오지 못했습니다. 기본 안내를 표시하고 있습니다.</p><button onClick={retry}>다시 불러오기</button></div> : null}
    {section === 'greeting' ? <Greeting name={fields?.name?.trim() || 'WELCOME TO DREAMING GOOD CHURCH'} pastor={pastor} title={copy('greeting_title')} introduction={copy('introduction')} closing={copy('greeting_closing')} portrait={portrait} /> : null}
    {section === 'directions' ? <section aria-label="오시는 길"><h2 className={styles.eyebrow}>VISIT OUR CHURCH</h2>
      {settingsStatus==='loading'?<p role="status">방문 안내를 불러오고 있습니다.</p>:settingsStatus==='error'?<div className={styles.unconfirmed}><p role="status">지도·방문 안내를 불러오지 못했습니다.</p><button onClick={retry}>다시 불러오기</button></div>:address?<><div className={styles.visitGrid}>
        <figure className={styles.sketchMap}><Image src="/brand/church-map.png" width={788} height={417} alt="교회 약도: 능곡 지하차도와 충장로 사이, 행신동 주민센터·행신 지구대 인근 선아빌딩 5층" unoptimized/><figcaption>{copy('map_caption')}</figcaption></figure>
        <div className={styles.visitInfo}>
          <h2>{fields?.name?.trim()||'꿈꾸는좋은교회'}</h2>
          <dl>
            <div><dt><SiteIcon name="pin" size={18}/>주소</dt><dd><p>{address}</p>{fields?.directions?.trim()?<p style={{whiteSpace:'pre-wrap'}}>{fields.directions}</p>:null}</dd></div>
            {location.transit?<div><dt><SiteIcon name="arrow" size={18}/>대중교통으로 오실 때</dt><dd><p style={{whiteSpace:'pre-wrap'}}>{location.transit}</p></dd></div>:null}
          </dl>
          <a href={`https://map.naver.com/p/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">네이버 지도에서 길찾기<SiteIcon name="diagonal"/></a>
        </div>
      </div>
      <iframe className={styles.mapFrame} title="꿈꾸는좋은교회 위치 지도" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${location.zoom}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></>:null}
      {phone?<div className={styles.contactRow}><div><h2>방문 문의</h2><p>{phone}</p></div><a href={`tel:${phone.replace(/[^+\d]/g,'')}`}><SiteIcon name="phone" size={18}/>전화 문의</a></div>:null}
    </section> : null}
    {section === 'worship-times' ? <><WorshipTimes additional />{worshipNote?<aside className={css.worshipNote} aria-label="예배 추가 안내"><h2>추가 안내</h2><p>{worshipNote}</p></aside>:null}<Link href="/worship" className={styles.textLink}>온라인으로 예배 함께하기<SiteIcon /></Link></> : null}
    {section === 'offering' ? <section className={styles.prose} aria-label="온라인 헌금"><p className={styles.eyebrow}>ONLINE OFFERING</p><h2 style={{whiteSpace:'pre-line'}}>{copy('offering_title')}</h2>{settingsStatus==='loading'?<p role="status">헌금계좌를 확인하고 있습니다.</p>:settingsStatus==='error'?<div className={styles.unconfirmed}><p role="status">현재 헌금계좌를 확인할 수 없습니다. 다시 불러온 뒤 확인해 주세요.</p><button onClick={retry}>다시 불러오기</button></div>:<Offering accounts={settings.offering_accounts} note={copy('offering_note')} />}</section> : null}
  </main>;
}
