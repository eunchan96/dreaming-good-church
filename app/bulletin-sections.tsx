'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BulletinItem } from '@/lib/bulletins';
import styles from './public-site.module.css';
import content from './public-content.module.css';
type Data = { serviceDate: string | null; items: Pick<BulletinItem, 'id'|'title'|'body'|'kind'|'content'>[] };
export default function BulletinSections({ section }: { section: 'torah-tov' | 'worship' }) {
  const [data, setData] = useState<Data | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let sequence = 0;
    async function refresh() { const current = ++sequence; try {
      const r = await fetch(`/api/bulletin-sections?section=${section}`, { cache: 'no-store', signal: controller.signal });
      if (!r.ok) throw new Error(); const result = await r.json();
      if (!controller.signal.aborted && current === sequence) { setData(result); setFailed(false); }
    } catch { if (!controller.signal.aborted && current === sequence) { setData(null); setFailed(true); } } }
    void refresh(); const timer = window.setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [section, retry]);
  return <section className={styles.bulletinExcerpt} aria-label={section === 'torah-tov' ? '이번 주 묵상과 암송' : '주보의 예배 말씀'}>
    {section === 'worship' ? <h2>주보의 예배 말씀</h2> : null}
    {failed ? <div className={content.state}><p role="status">주보의 공개 안내를 불러오지 못했습니다.</p><button onClick={() => setRetry(x => x + 1)}>다시 불러오기</button></div> : !data ? <p role="status">공개 안내를 불러오고 있습니다…</p> : <>
      {data.serviceDate ? <p className={styles.excerptDate}>{data.serviceDate} 주보에 실린 내용입니다.</p> : null}
      {!data.items.length ? <div className={content.state}><p>{section === 'torah-tov' ? '아직 공개된 묵상·암송 안내가 없습니다.' : '현재 주보에 공개된 예배 말씀 안내가 없습니다.'}</p></div> : <div className={content.list}>{data.items.map(item => <article key={item.id} className={content.card}>{section === 'torah-tov' ? <h2>{item.title}</h2> : <h3>{item.title}</h3>}{item.kind === 'sermon' ? <p>{[item.content?.reference, item.content?.preacher].filter(Boolean).join(' · ')}</p> : null}<p>{item.body}</p></article>)}</div>}
      {data.serviceDate ? <Link className={styles.textLink} href={`/bulletins/${data.serviceDate}`}>이 주보 전체 보기</Link> : null}
    </>}
  </section>;
}
