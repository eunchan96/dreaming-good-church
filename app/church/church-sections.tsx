'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import SiteIcon from '../site-icon';
import type { ChurchPageSettings } from '@/lib/church-page-settings';
import { BulletinImageView } from '../bulletin-image';
import type { Portrait } from '../church-content';
import css from './church.module.css';

/** 인사말: church name label, greeting text with the pastor's signature, and the pastor photo on the right (between label and text on mobile). */
export function Greeting({ name, pastor, title, introduction, closing, portrait }: { name: string; pastor: string | null; title: string; introduction: string; closing: string; portrait: Portrait }) {
  const photoAlt = portrait?.alt || (pastor ? `담임목사 ${pastor} 사진` : '담임목사 사진');
  return <section className={css.greeting} aria-label="인사말">
    <p className={css.eyebrow}>{name}</p>
    <div className={css.greetingText}>
      <h2>{title}</h2>
      <p>{introduction}</p>
      <p>{closing}</p>
      {pastor ? <p className={css.signature}>담임목사 <strong>{pastor}</strong></p> : null}
    </div>
    <figure className={css.portrait}>
      {portrait ? <BulletinImageView key={portrait.imageId} id={portrait.imageId} alt={photoAlt} fallback={<div className={css.portraitEmpty} aria-hidden="true" />} /> : <div className={css.portraitEmpty} aria-hidden="true"><svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="24" cy="18" r="8" /><path d="M9 41c2-8 8-12 15-12s13 4 15 12" /></svg></div>}
    </figure>
  </section>;
}

const accountName = (key: string) => key === 'general' ? '온라인 헌금' : key === 'building' ? '건축 헌금' : '헌금';

/** 온라인 헌금: account cards with a copy button. */
export function Offering({ accounts, note }: { accounts: ChurchPageSettings['offering_accounts']; note: string }) {
  const [copied, setCopied] = useState('');
  async function copy(key: string, number: string) {
    try { await navigator.clipboard.writeText(number); setCopied(key); window.setTimeout(() => setCopied(current => current === key ? '' : current), 2000); }
    catch { setCopied(''); }
  }
  return <div className={css.offering}>
    <div className={css.accounts}>{accounts.map(account => <article key={account.key} className={css.account}>
      <h3>{accountName(account.key)}</h3>
      <p className={css.number}>{account.number}</p>
      <p className={css.bank}><span>{account.bank}</span>예금주 {account.holder}</p>
      <button type="button" onClick={() => void copy(account.key, account.number)} aria-label={`${accountName(account.key)} 계좌번호 복사`}>{copied === account.key ? '복사했어요' : '계좌번호 복사'}</button>
      <span role="status" className={css.srOnly}>{copied === account.key ? '계좌번호를 복사했습니다.' : ''}</span>
    </article>)}</div>
    <p className={css.note}>{note}</p>
  </div>;
}

type Visit = { name: string; address: string; directions: string | null; transit: string | null; phone: string | null; mapSrc: string };

/** 오시는 길: sketch map (opens large) with map/copy actions under it, beside one info block — address, transit cards, phone; the live map sits below. */
export function Directions({ name, address, directions, transit, phone, mapSrc }: Visit) {
  // Each line of the transit note becomes its own short card.
  const stops = (transit ?? '').split('\n').map(line => line.trim()).filter(Boolean);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setCopied(false); }
  }
  // On narrow screens the enlarged sketch scrolls sideways; start centred on the church.
  function openSketch() { const el = dialog.current; if (!el) return; el.showModal(); const frame = el.firstElementChild; if (frame) frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2; }
  const sketch = { src: '/brand/church-map.png', width: 788, height: 417, unoptimized: true, alt: '교회 약도: 능곡 지하차도와 충장로 사이, 행신동 주민센터·행신 지구대 인근 선아빌딩 5층' };
  return <>
    <div className={css.visit}>
      <div className={css.sketchColumn}>
        <figure className={css.sketch}>
          <button type="button" onClick={openSketch} aria-label="약도 크게 보기"><Image {...sketch} alt={sketch.alt} /><span aria-hidden="true"><SiteIcon name="expand" size={15} />크게 보기</span></button>
        </figure>
        <div className={css.mapActions}>
          <a href={`https://map.naver.com/p/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">네이버 지도<SiteIcon name="diagonal" size={15} /></a>
          <a href={`https://map.kakao.com/link/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">카카오맵<SiteIcon name="diagonal" size={15} /></a>
          <button type="button" onClick={() => void copy()}><SiteIcon name="copy" size={15} />{copied ? '복사했어요' : '주소 복사'}</button>
          <span role="status" className={css.srOnly}>{copied ? '주소를 복사했습니다.' : ''}</span>
        </div>
      </div>
      <div className={css.visitInfo}>
        <h2>{name}</h2>
        <dl>
          <div><dt><SiteIcon name="pin" size={18} />주소</dt><dd><p>{address}</p>{directions ? <p className={css.muted}>{directions}</p> : null}</dd></div>
          {stops.length ? <div><dt><SiteIcon name="arrow" size={18} />대중교통으로 오실 때</dt><dd><ul className={css.transitCards}>{stops.map(stop => <li key={stop}><SiteIcon name={/도보|분/.test(stop) ? 'clock' : 'pin'} size={17} /><span>{stop}</span></li>)}</ul></dd></div> : null}
          {phone ? <div><dt><SiteIcon name="phone" size={18} />방문 문의</dt><dd><a className={css.phone} href={`tel:${phone.replace(/[^+\d]/g, '')}`} aria-label={`전화 걸기 ${phone}`}>{phone}<SiteIcon size={15} /></a></dd></div> : null}
        </dl>
      </div>
    </div>
    <iframe className={css.liveMap} title="꿈꾸는좋은교회 위치 지도" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
    <dialog ref={dialog} className={css.sketchDialog} aria-label="약도 크게 보기" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div><Image {...sketch} alt={sketch.alt} /></div>
      <form method="dialog"><button aria-label="닫기"><SiteIcon name="close" size={20} /></button></form>
    </dialog>
  </>;
}
