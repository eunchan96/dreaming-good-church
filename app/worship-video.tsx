'use client';
import { useEffect, useState } from 'react';
import { VERIFIED_SUNDAY_VIDEO } from '@/lib/youtube-video.mjs';
import { worshipTypes, type WorshipType } from '@/lib/site-content';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';
export default function WorshipVideo({ type = 'sunday', compact = false }: { type?: WorshipType; compact?: boolean }) {
  const [video, setVideo] = useState(VERIFIED_SUNDAY_VIDEO);
  useEffect(() => {
    if (type !== 'sunday') return;
    const controller = new AbortController();
    fetch('/api/worship', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => {
      if (data && /^[\w-]{11}$/.test(data.id) && typeof data.title === 'string' && data.title.length < 250 && ['channel', 'verified'].includes(data.source)) setVideo(data);
    }).catch(() => {});
    return () => controller.abort();
  }, [type]);
  const worship = worshipTypes.find(w => w.key === type)!;
  const src = type === 'sunday' ? `https://www.youtube-nocookie.com/embed/${video.id}?rel=0` : `https://www.youtube-nocookie.com/embed/videoseries?list=${worship.playlist}&rel=0`;
  return <div className={styles.videoBlock}><div className={styles.videoFrame}><iframe src={src} title={`${worship.name} 영상`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div><div className={styles.videoCaption}><div><p>{type === 'sunday' ? video.source === 'verified' ? '최근 확인한 주일 말씀' : '최근 주일 말씀' : `${worship.name} 재생목록`}</p><h3>{type === 'sunday' ? video.title : '예배의 은혜를 함께 나눕니다'}</h3></div><a href={type === 'sunday' ? `https://www.youtube.com/watch?v=${video.id}` : `https://www.youtube.com/playlist?list=${worship.playlist}`} target="_blank" rel="noreferrer" aria-label={`${worship.name} YouTube에서 보기`}>{!compact ? 'YouTube에서 보기' : 'YouTube'}<SiteIcon name="diagonal" size={17} /></a></div></div>;
}
