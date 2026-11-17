'use client';
import {useEffect,useState} from 'react';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';

// Floating "back to top" button that appears once the reader has scrolled past the first screen.
export default function TopButton(){
 const [shown,setShown]=useState(false);
 useEffect(()=>{const update=()=>setShown(window.scrollY>window.innerHeight*.8);update();window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update);},[]);
 return <button className={styles.topButton} data-shown={shown} tabIndex={shown?0:-1} aria-hidden={!shown} aria-label="맨 위로 이동" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><SiteIcon size={18} style={{transform:'rotate(-90deg)'}}/></button>;
}
