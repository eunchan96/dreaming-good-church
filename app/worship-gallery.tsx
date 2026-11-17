'use client';
import {useEffect,useRef,useState} from 'react';
import {VERIFIED_SUNDAY_VIDEO} from '@/lib/youtube-video.mjs';
import {worshipTypes,YOUTUBE_CHANNEL,type WorshipType} from '@/lib/site-content';
import type {PublicWorshipEntry} from '@/lib/worship-library';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';
type Cursor={date:string;id:string}|null;
type Legacy={id:string;title:string;source:string};
export default function WorshipGallery({type,compact}:{type:WorshipType;compact:boolean}){
 const [rows,setRows]=useState<PublicWorshipEntry[]>([]),[selected,setSelected]=useState<PublicWorshipEntry|null>(null);
 const [fallback,setFallback]=useState<Legacy|null>(null),[next,setNext]=useState<Cursor>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 const strip=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null);
 useEffect(()=>{const controller=new AbortController();request.current=controller;
  async function load(){setLoading(true);setFailed(false);try{
   const r=await fetch(`/api/worship/videos?type=${type}`,{signal:controller.signal,cache:'no-store'});if(!r.ok)throw new Error();
   const data=await r.json() as {videos:PublicWorshipEntry[];featured:PublicWorshipEntry|null;next:Cursor};
   const list=[...(data.featured?[data.featured]:[]),...data.videos.filter(row=>row.id!==data.featured?.id)];
   setRows(list);setSelected(list[0]??null);setNext(data.next);
   if(!list.length&&type==='sunday'){
    const legacy=await fetch('/api/worship',{signal:controller.signal});if(!legacy.ok)throw new Error();const video=await legacy.json();
    setFallback(video&&/^[\w-]{11}$/.test(video.id)&&typeof video.title==='string'&&video.title.length<250&&['channel','verified'].includes(video.source)?video:VERIFIED_SUNDAY_VIDEO);
   }else setFallback(null);
  }catch{if(!controller.signal.aborted)setFailed(true);}finally{if(!controller.signal.aborted)setLoading(false);}}
  void load();return()=>{controller.abort();request.current=null;};
 },[type,retry]);
 async function more(){if(!next||loading)return;const controller=request.current;if(!controller)return;setLoading(true);setFailed(false);try{
  const r=await fetch(`/api/worship/videos?type=${type}&beforeDate=${next.date}&beforeId=${next.id}`,{signal:controller.signal,cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json() as {videos:PublicWorshipEntry[];next:Cursor};
  setRows(current=>[...current,...data.videos.filter(row=>!current.some(x=>x.id===row.id))]);setNext(data.next);
 }catch{if(!controller.signal.aborted)setFailed(true);}finally{if(!controller.signal.aborted)setLoading(false);}}
 const worship=worshipTypes.find(w=>w.key===type)!,id=selected?.video_id??fallback?.id,title=selected?.title??fallback?.title;
 return <div className={styles.videoBlock}>
  {id?<><div className={styles.videoFrame}><iframe key={id} src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`} title={`${worship.name} 영상`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/></div><div className={styles.videoCaption}><div><p>{selected?`${selected.service_date} · ${worship.name}${selected.featured?' · 대표 영상':''}`:fallback?.source==='verified'?'최근 확인한 주일 말씀':'최근 주일 말씀'}</p><h3>{title}</h3></div><a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer" aria-label={`${worship.name} YouTube에서 보기`}>{compact?'YouTube':'YouTube에서 보기'}<SiteIcon name="diagonal" size={17}/></a></div></>:null}
  {!compact&&rows.length>0?<section className={styles.videoCollection} aria-label={`${worship.name} 영상 목록`}><div className={styles.videoCollectionHeading}><h3>함께 나눈 말씀</h3><div><button aria-label="이전 영상 쪽으로 이동" onClick={()=>strip.current?.scrollBy({left:-480,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><SiteIcon/></button><button aria-label="다음 영상 쪽으로 이동" onClick={()=>strip.current?.scrollBy({left:480,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><SiteIcon/></button></div></div><div ref={strip} className={styles.videoStrip}>{rows.map(row=><button key={row.id} aria-pressed={selected?.id===row.id} onClick={()=>setSelected(row)} className={styles.videoChoice}>
   {/* Fixed-host thumbnails; playback uses the direct iframe. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={`https://i.ytimg.com/vi/${row.video_id}/mqdefault.jpg`} alt="" loading="lazy" width={320} height={180}/><span>{row.service_date}{row.featured?' · 대표':''}</span><strong>{row.title}</strong></button>)}</div>{next?<button className={styles.moreVideos} disabled={loading} onClick={()=>void more()}>{loading?'불러오는 중…':'이전 영상 더 보기'}</button>:null}</section>:null}
  {failed?<div className={styles.unconfirmed}><p role="status">예배 영상을 불러오지 못했습니다.</p><button disabled={loading} onClick={()=>{if(rows.length&&next)void more();else setRetry(n=>n+1);}}>다시 불러오기</button></div>:loading&&!id?<p role="status">예배 영상을 불러오고 있습니다.</p>:!id?<div className={styles.videoEmpty}><p>등록된 {worship.name} 영상을 준비하고 있습니다.</p><a href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer">교회 YouTube 채널에서 보기<SiteIcon name="diagonal" size={16}/></a></div>:null}
 </div>;
}
