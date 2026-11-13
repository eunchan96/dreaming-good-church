'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CHURCH_ADDRESS, CHURCH_PHONE, CHURCH_LOCATION, CHURCH_VISIT, YOUTUBE_CHANNEL, siteNavigation, offeringAccounts } from '@/lib/site-content';
import SiteIcon from '../site-icon';
import WorshipTimes from '../worship-times';
import styles from '../public-site.module.css';
type Section = 'greeting' | 'directions' | 'worship-times' | 'offering';
export default function ChurchReader({ section = 'greeting' }: { section?: Section }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { const controller = new AbortController(); let sequence = 0;
    async function load() { const current = ++sequence; try { const r = await fetch('/api/church', { cache: 'no-store', signal: controller.signal }); if (!r.ok) throw new Error(); const data = await r.json(); if (!controller.signal.aborted && current === sequence) { setFields(Object.fromEntries(data.fields.map((f: { key: string; body: string }) => [f.key, f.body]))); setFailed(false); } } catch { if (!controller.signal.aborted && current === sequence) setFailed(true); } }
    void load(); const timer = window.setInterval(load, 15000); window.addEventListener('focus', load); return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [retry]);
  const address = (fields.address?.trim() || CHURCH_ADDRESS).replace('선인빌딩', '선아빌딩');
  const mapQuery = address.replace(/\s/g, '') === CHURCH_ADDRESS.replace(/\s/g, '') ? `${CHURCH_LOCATION.latitude},${CHURCH_LOCATION.longitude}` : address;
  return <main id="public-content" tabIndex={-1} className={styles.subpage}>
    <header className={styles.pageHeading}><p className={styles.eyebrow}>ABOUT OUR CHURCH</p><h1>교회 소개</h1><p>예배로 모이고, 사랑으로 살아가는 꿈꾸는좋은교회입니다.</p></header>
    <nav className={styles.subnav} aria-label="교회 소개 메뉴">{siteNavigation[0].links.map(link => <Link key={link.href} href={link.href} aria-current={(section === 'greeting' ? '/church' : `/church/${section}`) === link.href ? 'page' : undefined}>{link.label}</Link>)}</nav>
    {failed ? <div className={styles.unconfirmed}><p role="status">등록된 교회 안내를 불러오지 못했습니다. 기본 안내를 표시하고 있습니다.</p><button onClick={() => setRetry(x => x + 1)}>다시 불러오기</button></div> : null}
    {section === 'greeting' ? <section className={styles.prose}><p className={styles.eyebrow}>WELCOME TO DREAMING GOOD CHURCH</p><h2>함께 예배하는 기쁨,<br />함께 걸어가는 믿음.</h2><p>{fields.introduction?.trim() || '꿈꾸는좋은교회에 오신 여러분을 주님의 이름으로 환영합니다.\n하나님 앞에서 더 나은 예배를 드리고, 일상에서 사랑을 나누는 공동체를 함께 꿈꿉니다.'}</p><p>온라인에서도 말씀과 교회의 소식을 만나보세요.<br />예배의 자리에서 여러분을 기다립니다.</p><a href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer"><SiteIcon name="youtube" />교회 YouTube 채널<SiteIcon name="diagonal" size={16} /></a></section> : null}
    {section === 'directions' ? <section aria-label="오시는 길"><h2 className={styles.eyebrow}>VISIT OUR CHURCH</h2><iframe className={styles.mapFrame} title="꿈꾸는좋은교회 위치 지도" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><div className={styles.contactRow}><div><h2>꿈꾸는좋은교회</h2><p>{address}</p><p>{CHURCH_VISIT}</p>{fields.directions?.trim() ? <p style={{ whiteSpace: 'pre-wrap' }}>{fields.directions}</p> : null}</div><a href={`https://map.naver.com/p/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">네이버 지도에서 길찾기<SiteIcon name="diagonal" /></a></div><div className={styles.contactRow}><div><h2>대중교통으로 오실 때</h2><p>샘터마을2단지아파트 앞에 있습니다.<br />행신초등학교에서 도보로 약 2분 거리입니다.</p></div></div><div className={styles.contactRow}><div><h2>방문 문의</h2><p>{fields.phone?.trim() || CHURCH_PHONE}</p></div><a href={`tel:${(fields.phone?.trim() || CHURCH_PHONE).replace(/[^+\d]/g, '')}`}><SiteIcon name="phone" size={18} />전화 문의</a></div></section> : null}
    {section === 'worship-times' ? <><WorshipTimes additional />{fields.worship?.trim() ? <div className={styles.prose}><h2>예배 안내</h2><p>{fields.worship}</p></div> : null}<Link href="/worship" className={styles.textLink}>온라인으로 예배 함께하기<SiteIcon /></Link></> : null}
    {section === 'offering' ? <section className={styles.prose}><p className={styles.eyebrow}>ONLINE OFFERING</p><h2>감사의 마음을<br />함께 나눕니다.</h2><div className={styles.accountGrid}>{offeringAccounts.map(account => <article className={styles.accountCard} key={account.name}><h3>{account.name}</h3><p>{account.bank} · 예금주 {account.holder}</p><strong>{account.number}</strong></article>)}</div><p>송금 전 은행명·계좌번호·예금주를 확인해 주세요.</p></section> : null}
  </main>;
}
