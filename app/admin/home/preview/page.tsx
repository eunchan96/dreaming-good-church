'use client';
import {useEffect,useRef,useState} from 'react';
import {defaultHomeContent,validHomeContent,type HomeContent} from '@/lib/home-content';
import HomeHero from '@/app/home-hero';
import styles from '@/app/public-site.module.css';
export default function Preview(){
 const [content,setContent]=useState<HomeContent>(defaultHomeContent),[src,setSrc]=useState('');
 const main=useRef<HTMLElement>(null);
 useEffect(()=>{if(!main.current||parent===window)return;const report=()=>parent.postMessage({type:'homepage-preview-height',height:Math.ceil(main.current!.getBoundingClientRect().height)},location.origin);const observer=new ResizeObserver(report);observer.observe(main.current);report();return()=>observer.disconnect();},[]);
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==parent||parent===window||e.data?.type!=='homepage-preview'||!validHomeContent(e.data.content,true))return;
  let image='';try{const url=new URL(e.data.imageSrc);if(url.protocol==='blob:'&&url.origin===location.origin)image=url.href;}catch{}
  setContent(e.data.content);setSrc(image);
 };addEventListener('message',receive);if(parent!==window)parent.postMessage({type:'homepage-preview-ready'},location.origin);return()=>removeEventListener('message',receive);},[]);
 return <div className={styles.site} style={{minHeight:0}}><main ref={main}><HomeHero content={content} imageSrc={src} preview/></main></div>;
}
