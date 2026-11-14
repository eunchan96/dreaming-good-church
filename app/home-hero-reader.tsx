'use client';
import {useEffect,useState} from 'react';
import {defaultHomeContent,validHomeContent,type HomeContent} from '@/lib/home-content';
import HomeHero from './home-hero';
export default function HomeHeroReader(){const [content,setContent]=useState<HomeContent>(defaultHomeContent);
 useEffect(()=>{const abort=new AbortController();void fetch('/api/home-content',{cache:'no-store',signal:abort.signal}).then(r=>r.ok?r.json():null).then(data=>{if(validHomeContent(data?.content))setContent(data.content);}).catch(()=>{});return()=>abort.abort();},[]);
 return <HomeHero content={content}/>;
}
