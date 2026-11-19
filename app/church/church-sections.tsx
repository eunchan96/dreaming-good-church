'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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

/** Transit cards: one equal-width card per line, side by side (stacked on phones). */
function TransitCards({ stops }: { stops: string[] }) {
  return <ul className={css.transitCards} style={{ '--cards': stops.length } as CSSProperties}>
    {stops.map(stop => <li key={stop}><SiteIcon name={/도보|분/.test(stop) ? 'clock' : 'pin'} size={17} /><span>{stop}</span></li>)}
  </ul>;
}

type Visit = { name: string; address: string; directions: string | null; transit: string | null; phone: string | null; mapSrc: string };

/** 오시는 길: sketch map (opens large) beside one info block — address with a copy button, phone, transit cards; the live map and map-app links sit below. */
export function Directions({ name, address, directions, transit, phone, mapSrc }: Visit) {
  // Each line of the transit note becomes its own short card.
  const stops = (transit ?? '').split('\n').map(line => line.trim()).filter(Boolean);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const visit = useRef<HTMLDivElement>(null), info = useRef<HTMLDivElement>(null);
  // Side by side, the sketch column shrinks so the sketch is no taller than the info column.
  useLayoutEffect(() => {
    const grid = visit.current, right = info.current;
    if (!grid || !right) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!matchMedia('(min-width: 901px)').matches) { grid.style.gridTemplateColumns = ''; return; }
        const widest = (grid.clientWidth - 48) * 1.1 / 2.1, chrome = 50;
        const target = (right.getBoundingClientRect().height - chrome) * 788 / 417 + chrome;
        const width = Math.round(Math.max(320, Math.min(widest, target)));
        const current = parseFloat(grid.style.gridTemplateColumns) || 0;
        if (Math.abs(current - width) > 1) grid.style.gridTemplateColumns = `${width}px minmax(0, 1fr)`;
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(right);
    observer.observe(grid);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setCopied(false); }
  }
  // On narrow screens the enlarged sketch scrolls sideways; start centred on the church.
  function openSketch() { const el = dialog.current; if (!el) return; el.showModal(); const frame = el.firstElementChild; if (frame) frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2; }
  const sketch = { src: '/brand/church-map.png', width: 788, height: 417, unoptimized: true, alt: '교회 약도: 능곡 지하차도와 충장로 사이, 행신동 주민센터·행신 지구대 인근 선아빌딩 5층' };
  return <>
    <div ref={visit} className={css.visit}>
      <figure className={css.sketch}>
        <button type="button" onClick={openSketch} aria-label="약도 크게 보기"><Image {...sketch} alt={sketch.alt} /><span aria-hidden="true"><SiteIcon name="expand" size={15} />크게 보기</span></button>
      </figure>
      <div ref={info} className={css.visitInfo}>
        <h2>{name}</h2>
        {/* 주소·문의 share one label column; long values wrap inside the value column. */}
        <dl className={css.facts}>
          <div><dt><SiteIcon name="pin" size={18} />주소</dt><dd><p>{address}<button type="button" className={css.copyAddress} onClick={() => void copy()} data-copied={copied}>{copied ? '복사했어요' : '주소 복사'}</button></p>{directions ? <p className={css.muted}>{directions}</p> : null}<span role="status" className={css.srOnly}>{copied ? '주소를 복사했습니다.' : ''}</span></dd></div>
          {phone ? <div><dt><SiteIcon name="phone" size={18} />문의</dt><dd><a className={css.phone} href={`tel:${phone.replace(/[^+\d]/g, '')}`} aria-label={`전화 걸기 ${phone}`}>{phone}<SiteIcon size={15} /></a></dd></div> : null}
        </dl>
        {stops.length ? <dl className={css.transitBlock}><div><dt><SiteIcon name="arrow" size={18} />대중교통으로 오실 때</dt><dd><TransitCards stops={stops} /></dd></div></dl> : null}
      </div>
    </div>
    <iframe className={css.liveMap} title="꿈꾸는좋은교회 위치 지도" src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
    <div className={css.mapActions}>
      <a className={css.textLink} href={`https://map.naver.com/p/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">네이버 지도로 보기<SiteIcon name="diagonal" size={16} /></a>
      <a className={css.textLink} href={`https://map.kakao.com/link/search/${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">카카오맵으로 보기<SiteIcon name="diagonal" size={16} /></a>
    </div>
    <dialog ref={dialog} className={css.sketchDialog} aria-label="약도 크게 보기" onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div><Image {...sketch} alt={sketch.alt} /></div>
      <form method="dialog"><button aria-label="닫기"><SiteIcon name="close" size={20} /></button></form>
    </dialog>
  </>;
}
