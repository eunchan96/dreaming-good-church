'use client';
import { useState } from 'react';
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
