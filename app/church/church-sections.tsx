'use client';
import { useState } from 'react';
import type { ChurchPageSettings } from '@/lib/church-page-settings';
import { PASTOR_PHOTO, YOUTUBE_CHANNEL } from '@/lib/site-content';
import SiteIcon from '../site-icon';
import css from './church.module.css';

/** 인사말: pastor photo (placeholder until the photo is ready) beside the greeting. */
export function Greeting({ name, introduction }: { name: string; introduction: string | null }) {
  return <section className={css.greeting} aria-label="인사말">
    <figure className={css.portrait}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand photo, swapped in when ready */}
      {PASTOR_PHOTO ? <img src={PASTOR_PHOTO.src} alt={PASTOR_PHOTO.alt} /> : <div className={css.portraitEmpty} aria-hidden="true"><svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="24" cy="18" r="8" /><path d="M9 41c2-8 8-12 15-12s13 4 15 12" /></svg></div>}
      {PASTOR_PHOTO?.caption ? <figcaption>{PASTOR_PHOTO.caption}</figcaption> : null}
    </figure>
    <div className={css.greetingText}>
      <p className={css.eyebrow}>{name}</p>
      <h2>함께 예배하는 기쁨,<br />함께 걸어가는 믿음.</h2>
      {introduction ? <p>{introduction}</p> : null}
      <p>온라인에서도 말씀과 교회의 소식을 만나보세요.<br />예배의 자리에서 여러분을 기다립니다.</p>
      <a href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer"><SiteIcon name="youtube" />교회 YouTube 채널<SiteIcon name="diagonal" size={16} /></a>
    </div>
  </section>;
}

const accountName = (key: string) => key === 'general' ? '온라인 헌금' : key === 'building' ? '건축 헌금' : '헌금';

/** 온라인 헌금: account cards with a copy button. */
export function Offering({ accounts }: { accounts: ChurchPageSettings['offering_accounts'] }) {
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
    <p className={css.note}>송금 전 은행명·계좌번호·예금주를 한 번 더 확인해 주세요.</p>
  </div>;
}
