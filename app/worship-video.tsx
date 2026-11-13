'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { VERIFIED_SUNDAY_VIDEO } from '@/lib/youtube-video.mjs';
import { worshipTypes, type WorshipType } from '@/lib/site-content';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';
export default function WorshipVideo({ type = 'sunday', compact = false }: { type?: WorshipType; compact?: boolean }) {
  const [video, setVideo] = useState(VERIFIED_SUNDAY_VIDEO);
  const [playing, setPlaying] = useState(false);
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
  return <div className={styles.videoBlock}><div className={styles.videoFrame}>{playing ? <iframe src={src} title={`${worship.name} 영상`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <button className={styles.videoPoster} onClick={() => setPlaying(true)} aria-label={`${worship.name} 영상 열기`}>{type === 'sunday' ? <VideoPoster key={video.id} id={video.id} /> : <span className={styles.playlistPoster}><span>WORSHIP TOGETHER</span><strong>{worship.name}</strong><span>교회 YouTube 재생목록</span></span>}<span className={styles.posterPlay}><SiteIcon name="play" size={28} /></span><span className={styles.posterLabel}>영상 열기</span></button>}</div><div className={styles.videoCaption}><div><p>{type === 'sunday' ? video.source === 'verified' ? '최근 확인한 주일 말씀' : '최근 주일 말씀' : `${worship.name} 재생목록 · YouTube 등록 순서`}</p><h3>{type === 'sunday' ? video.title : '예배의 은혜를 함께 나눕니다'}</h3></div><a href={type === 'sunday' ? `https://www.youtube.com/watch?v=${video.id}` : `https://www.youtube.com/playlist?list=${worship.playlist}`} target="_blank" rel="noreferrer" aria-label={`${worship.name} YouTube에서 보기`}>{!compact ? 'YouTube에서 보기' : 'YouTube'}<SiteIcon name="diagonal" size={17} /></a></div></div>;
}
function VideoPoster({ id }: { id: string }) {
  const [variant, setVariant] = useState(0);
  if (variant === 2) return <span className={styles.playlistPoster}><span>SUNDAY WORSHIP</span><strong>함께 듣는 주일 말씀</strong><span>꿈꾸는좋은교회</span></span>;
  return <Image unoptimized src={`https://i.ytimg.com/vi/${id}/${variant ? 'hqdefault' : 'maxresdefault'}.jpg`} alt="" width={1280} height={720} onLoad={e => { if (variant === 0 && e.currentTarget.naturalWidth < 480) setVariant(1); }} onError={() => setVariant(current => Math.min(2, current + 1))} />;
}
