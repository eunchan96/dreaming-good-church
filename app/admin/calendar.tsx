'use client';

import {useId,useRef,useState,type KeyboardEvent} from 'react';
import ui from './calendar.module.css';
export type CalendarRange={start:string;end:string};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateOf=(value:string)=>new Date((value.slice(0,10)||today())+'T12:00:00');
const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function formatCalendarDate(value:string,time=false){
 if(!value)return '';
 const date=dateOf(value);const label=`${date.getFullYear()}년 ${date.getMonth()+1}월 ${date.getDate()}일`;
 if(!time||!value.includes('T'))return label;
 const [hour,minute]=value.slice(11,16).split(':').map(Number);
 return `${label} ${hour<12?'오전':'오후'} ${hour%12||12}:${String(minute).padStart(2,'0')}`;
}
function CalendarIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>;}

type Props={id?:string;label:string;value:string;onChange:(value:string)=>void;time?:boolean;optional?:boolean;disabled?:boolean};
export function DatePicker({id,label,value,onChange,time=false,optional=false,disabled=false}:Props){
 return <CalendarPicker id={id} label={label} value={value} onChange={onChange} time={time} optional={optional} disabled={disabled}/>;
}
export function DateRangePicker({value,onChange}:{value:CalendarRange;onChange:(range:CalendarRange)=>void}){
 return <CalendarPicker label="날짜 검색" value={value.start} end={value.end} range onRangeChange={onChange} onChange={()=>{}} optional/>;
}
function CalendarPicker({id,label,value,end='',onChange,onRangeChange,range=false,time=false,optional=false,disabled=false}:Props&{range?:boolean;end?:string;onRangeChange?:(range:CalendarRange)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),grid=useRef<HTMLDivElement>(null);
 const heading=useId();const [draft,setDraft]=useState(''),[finish,setFinish]=useState(''),[side,setSide]=useState<'start'|'end'>('start');
 const [month,setMonth]=useState(()=>dateOf(value)),[choosingMonth,setChoosingMonth]=useState(false),[year,setYear]=useState('');
 const [hour,setHour]=useState('10'),[minute,setMinute]=useState('00'),[focused,setFocused]=useState('');
 const close=()=>{dialog.current?.close();trigger.current?.focus();};
 function open(){const initial=dateOf(value);setDraft(value.slice(0,10));setFinish(end);setSide('start');setMonth(initial);setYear(String(initial.getFullYear()));setChoosingMonth(false);setFocused(iso(initial));setHour(value.slice(11,13)||'10');setMinute(value.slice(14,16)||'00');dialog.current?.showModal();}
 function choose(day:string){setFocused(day);if(!range){setDraft(day);return;}if(side==='start'){setDraft(day);setFinish('');setSide('end');}else{if(draft&&day<draft){setFinish(draft);setDraft(day);}else setFinish(day);setSide('start');}}
 function moveMonth(delta:number){const next=new Date(month.getFullYear(),month.getMonth()+delta,1);if(next.getFullYear()<1900||next.getFullYear()>2199)return;setMonth(next);setYear(String(next.getFullYear()));setFocused(iso(next));}
 function navigate(event:KeyboardEvent<HTMLButtonElement>,day:string){
  const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-dateOf(day).getDay(),End:6-dateOf(day).getDay()};
  if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();moveMonth(event.key==='PageUp'?-1:1);return;}
  if(!(event.key in offsets))return;event.preventDefault();const date=dateOf(day);date.setDate(date.getDate()+offsets[event.key]);if(date.getFullYear()<1900||date.getFullYear()>2199)return;
  const next=iso(date);setMonth(new Date(date.getFullYear(),date.getMonth(),1));setYear(String(date.getFullYear()));setFocused(next);requestAnimationFrame(()=>grid.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus());
 }
 function apply(){if(range)onRangeChange?.({start:draft,end:finish||draft});else onChange(draft+(time?`T${hour.padStart(2,'0')}:${minute.padStart(2,'0')}`:''));close();}
 const display=range?(value?`${formatCalendarDate(value)} – ${formatCalendarDate(end||value)}`:'날짜'):formatCalendarDate(value,time)||'날짜 선택';
 const first=new Date(month.getFullYear(),month.getMonth(),1),days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const validTime=/^\d{1,2}$/.test(hour)&&Number(hour)<=23&&/^\d{1,2}$/.test(minute)&&Number(minute)<=59;
 return <><button ref={trigger} id={id} type="button" className={ui.trigger} data-value={value} data-calendar-label={label} aria-label={`${label}: ${display}`} aria-haspopup="dialog" disabled={disabled} onClick={open}><span>{display}</span><CalendarIcon/></button>
 <dialog ref={dialog} data-calendar className={ui.dialog} aria-labelledby={heading} onCancel={()=>trigger.current?.focus()} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}><div className={ui.body}>
 <div className={ui.heading}><h2 id={heading}>{label}</h2><button type="button" aria-label="달력 닫기" onClick={close}>×</button></div>
 {range?<div className={ui.range}><button type="button" aria-pressed={side==='start'} onClick={()=>setSide('start')}><small>시작 날짜</small><span>{formatCalendarDate(draft)||'선택'}</span></button><span>—</span><button type="button" aria-pressed={side==='end'} onClick={()=>setSide('end')}><small>끝 날짜</small><span>{formatCalendarDate(finish)||'선택'}</span></button></div>:null}
 <div className={ui.month}><button type="button" aria-label="이전 달" disabled={month.getFullYear()===1900&&month.getMonth()===0} onClick={()=>moveMonth(-1)}>‹</button><button type="button" className={ui.monthTitle} aria-label={`${month.getFullYear()}년 ${month.getMonth()+1}월, 연도·월 선택`} aria-expanded={choosingMonth} onClick={()=>setChoosingMonth(!choosingMonth)}>{month.getFullYear()}년 {month.getMonth()+1}월 <span aria-hidden="true">⌄</span></button><button type="button" aria-label="다음 달" disabled={month.getFullYear()===2199&&month.getMonth()===11} onClick={()=>moveMonth(1)}>›</button></div>
 {choosingMonth?<div className={ui.monthChooser}><div className={ui.year}><button type="button" aria-label="이전 연도" disabled={Number(year)<=1900} onClick={()=>setYear(String(Number(year)-1))}>‹</button><label>연도<input aria-label="이동할 연도" inputMode="numeric" maxLength={4} value={year} onChange={e=>setYear(e.target.value.replace(/\D/g,''))}/></label><button type="button" aria-label="다음 연도" disabled={Number(year)>=2199} onClick={()=>setYear(String(Number(year)+1))}>›</button></div><div className={ui.monthGrid}>{Array.from({length:12},(_,i)=><button type="button" key={i} disabled={Number(year)<1900||Number(year)>2199||year.length!==4} aria-pressed={Number(year)===month.getFullYear()&&i===month.getMonth()} onClick={()=>{const date=new Date(Number(year),i,1);setMonth(date);setFocused(iso(date));setChoosingMonth(false);}}>{i+1}월</button>)}</div></div>:<><div ref={grid} className={ui.days} role="group" aria-label="날짜 선택">{['일','월','화','수','목','금','토'].map(day=><span key={day}>{day}</span>)}{Array.from({length:first.getDay()},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:days},(_,i)=>{const day=iso(new Date(month.getFullYear(),month.getMonth(),i+1));return <button type="button" key={day} data-day={day} tabIndex={day===focused?0:-1} aria-label={`${i+1}, ${month.getFullYear()}년 ${month.getMonth()+1}월`} aria-pressed={day===draft||range&&day===finish} aria-current={day===today()?'date':undefined} data-between={range&&!!draft&&!!finish&&day>draft&&day<finish} onKeyDown={e=>navigate(e,day)} onClick={()=>choose(day)}>{i+1}</button>;})}</div>{range?<p className={ui.hint} aria-live="polite">{side==='end'?'끝 날짜를 선택하세요':'시작 날짜를 선택하세요'}</p>:null}</>}
 {time?<div className={ui.time}><span>시간</span><label><span className={ui.srOnly}>시</span><input aria-label="시 (24시간제)" inputMode="numeric" maxLength={2} value={hour} onChange={e=>setHour(e.target.value.replace(/\D/g,''))}/></label><span>:</span><label><span className={ui.srOnly}>분</span><input aria-label="분" inputMode="numeric" maxLength={2} value={minute} onChange={e=>setMinute(e.target.value.replace(/\D/g,''))}/></label><small>24시간</small></div>:null}
 <div className={ui.footer}>{optional?<button type="button" onClick={()=>{if(range)onRangeChange?.({start:'',end:''});else onChange('');close();}}>초기화</button>:<button type="button" onClick={()=>{const date=dateOf(today());setDraft(today());setMonth(date);setYear(String(date.getFullYear()));setFocused(today());setChoosingMonth(false);}}>오늘</button>}<button type="button" disabled={!draft||time&&!validTime} onClick={apply}>적용</button></div>
 </div></dialog></>;
}
