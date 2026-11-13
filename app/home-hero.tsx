'use client';
import Link from 'next/link';
import {useLayoutEffect,useRef} from 'react';
import type {HomeContent} from '@/lib/home-content';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';
export default function HomeHero({content,imageSrc,preview=false}:{content:HomeContent;imageSrc?:string;preview?:boolean}){
 const heading=useRef<HTMLHeadingElement>(null);
 useLayoutEffect(()=>{const title=heading.current;if(!title)return;let active=true;const fit=()=>{if(!active)return;title.style.fontSize='';const width=title.clientWidth,max=Math.max(...Array.from(title.children).map(child=>child.scrollWidth));if(max>width)title.style.fontSize=`${Math.floor(parseFloat(getComputedStyle(title).fontSize)*width/max)}px`;};const observer=new ResizeObserver(fit);observer.observe(title.parentElement!);fit();void document.fonts.ready.then(fit);return()=>{active=false;observer.disconnect();};},[content.title_line1,content.title_line2]);
 const photo=content.image_mode!=='art'&&content.image_asset_id;
 return <section className={styles.hero} aria-labelledby="welcome-title"><div className={styles.heroInner}><div className={styles.heroCopy}><p className={styles.eyebrow}><span/>DREAMING GOOD CHURCH</p><h1 id="welcome-title" ref={heading} className={styles.managedHeroTitle}><span>{content.title_line1}</span><em>{content.title_line2}</em></h1><p className={styles.heroDescription}>{content.description_line1}<br/>{content.description_line2}</p><Link className={styles.heroLink} href="/church" onClick={e=>{if(preview)e.preventDefault();}}>{content.link_label}<span><SiteIcon size={23}/></span></Link></div>
  {photo?<div className={styles.heroMedia} data-mode={content.image_mode} data-ratio={content.image_ratio}>
   {/* Uploaded images are private until referenced by the saved homepage. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   {imageSrc||!preview?<img src={imageSrc??`/api/images?id=${content.image_asset_id}`} alt={content.image_alt} style={{objectFit:content.image_mode==='illustration'?'contain':'cover',objectPosition:`${content.focus_x}% ${content.focus_y}%`}}/>:<p>선택한 이미지 미리보기를 준비하고 있습니다.</p>}
  </div>:<div className={styles.heroArtwork} aria-hidden="true"><div className={styles.sunDisc}/><div className={styles.archway}><span className={styles.archCross}/><span className={styles.archLight}/></div><div className={styles.heroArtworkCaption}><span>FAITH, HOPE & LOVE</span><span>일상에 스며드는 믿음</span></div></div>}
 </div><div className={styles.heroFootnote}><span>{content.footnote}</span><a href="#home-worship" aria-label="아래 예배 영상으로 이동" onClick={e=>{if(preview)e.preventDefault();}}><span>SCROLL TO EXPLORE</span><SiteIcon size={18} style={{transform:'rotate(90deg)'}}/></a></div></section>;
}
