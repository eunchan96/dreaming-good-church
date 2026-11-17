'use client';
import {useId,useRef,useState,type PointerEvent} from 'react';
import SiteIcon from '@/app/site-icon';
import styles from './time-picker.module.css';
export const formatTime=(value:string)=>{if(!value)return '시간 선택';const [h,m]=value.split(':').map(Number);return `${h<12?'오전':'오후'} ${h%12||12}:${String(m).padStart(2,'0')}`;};
export default function TimePicker({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),dial=useRef<HTMLDivElement>(null),modeRef=useRef<'hour'|'minute'>('hour');
 const heading=useId();const [hour,setHour]=useState(10),[minute,setMinute]=useState(0),[mode,setMode]=useState<'hour'|'minute'>('hour');
 const close=()=>{dialog.current?.close();trigger.current?.focus();};
 function changeMode(next:'hour'|'minute'){modeRef.current=next;setMode(next);}
 function open(){const [h,m]=(value||'10:00').split(':').map(Number);setHour(h);setMinute(m);changeMode('hour');dialog.current?.showModal();}
 function fromPointer(event:PointerEvent<HTMLDivElement>){
  const rect=dial.current!.getBoundingClientRect(),x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2;
  const angle=(Math.atan2(x,-y)*180/Math.PI+360)%360;
  if(modeRef.current==='hour'){const h=Math.round(angle/30)%12;setHour(h+(hour>=12?12:0));}else setMinute(Math.round(angle/6)%60);
 }
 const angle=(mode==='hour'?hour%12*30:minute*6),selected=mode==='hour'?hour%12:minute;
 const numbers=Array.from({length:12},(_,i)=>mode==='hour'?(i===0?12:i):i*5);
 return <><button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" aria-label={`${label}: ${formatTime(value)}`} data-time-label={label} data-value={value} onClick={open}><span>{formatTime(value)}</span><SiteIcon name="clock" size={18}/></button>
 <dialog ref={dialog} data-time-picker className={styles.dialog} aria-labelledby={heading} onCancel={()=>trigger.current?.focus()} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}><div className={styles.heading}><h2 id={heading}>{label}</h2><button type="button" aria-label="시간 선택 닫기" onClick={close}><SiteIcon name="close"/></button></div>
 <div className={styles.readout}><div className={styles.period} role="group" aria-label="오전·오후"><button type="button" aria-pressed={hour<12} onClick={()=>setHour(hour%12)}>오전</button><button type="button" aria-pressed={hour>=12} onClick={()=>setHour(hour%12+12)}>오후</button></div><button type="button" aria-label={`${hour%12||12} 시 선택`} aria-pressed={mode==='hour'} onClick={()=>changeMode('hour')}>{hour%12||12}</button><span>:</span><button type="button" aria-label={`${String(minute).padStart(2,'0')} 분 선택`} aria-pressed={mode==='minute'} onClick={()=>changeMode('minute')}>{String(minute).padStart(2,'0')}</button></div>
 <div ref={dial} className={styles.dial} role="group" aria-label={mode==='hour'?'시 선택 시계':'분 선택 시계'} onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);fromPointer(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))fromPointer(e);}} onPointerUp={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;fromPointer(e);e.currentTarget.releasePointerCapture(e.pointerId);if(modeRef.current==='hour')changeMode('minute');}}>
 <div className={styles.hand} style={{transform:`rotate(${angle}deg)`}} aria-hidden="true"/><span className={styles.center} aria-hidden="true"/>
 {numbers.map((n,i)=>{const radians=i*Math.PI/6;return <button key={i} type="button" style={{left:`${50+39*Math.sin(radians)}%`,top:`${50-39*Math.cos(radians)}%`}} aria-pressed={selected===(mode==='hour'?n%12:n)} aria-label={`${mode==='minute'?String(n).padStart(2,'0'):n} ${mode==='hour'?'시':'분'}`} onClick={()=>{if(mode==='hour'){setHour(n%12+(hour>=12?12:0));changeMode('minute');}else setMinute(n);}}>{mode==='minute'?String(n).padStart(2,'0'):n}</button>;})}</div>
 <div className={styles.exact}><label><input aria-label="시 (24시간제)" type="number" min="0" max="23" value={hour} onFocus={()=>changeMode('hour')} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=23)setHour(n);}}/>시</label><label><input aria-label="분" type="number" min="0" max="59" value={minute} onFocus={()=>changeMode('minute')} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=59)setMinute(n);}}/>분</label></div>
 <div className={styles.footer}><button type="button" onClick={close}>취소</button><button type="button" onClick={()=>{onChange(`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);close();}}>적용</button></div></dialog></>;
}
