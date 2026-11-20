'use client';
import {useEffect,useState} from 'react';
import SiteIcon from './site-icon';
import styles from './public-site.module.css';

// Floating "back to top" button that appears once the reader has scrolled past the first screen.
export default function TopButton(){
 const [shown,setShown]=useState(false),[lift,setLift]=useState(0);
 // Rise above the footer's bottom row so the button never covers its links.
 useEffect(()=>{const update=()=>{setShown(window.scrollY>window.innerHeight*.8);const bar=document.querySelector('[data-footer-bottom]');setLift(bar?Math.max(0,window.innerHeight-bar.getBoundingClientRect().top):0);};update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};},[]);
 return <button className={styles.topButton} data-shown={shown} style={lift?{marginBottom:lift}:undefined} tabIndex={shown?0:-1} aria-hidden={!shown} aria-label="맨 위로 이동" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><SiteIcon size={16} style={{transform:'rotate(-90deg)'}}/><span>TOP</span></button>;
}
