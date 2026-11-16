'use client';
import {useState} from 'react';
import {worshipTypes} from '@/lib/site-content';
import type {WorshipEntry} from '@/lib/worship-library';
import AdminIcon from '../admin-icons';
import btn from '../buttons.module.css';
import css from './video-calendar.module.css';

const weekdays=['일','월','화','수','목','금','토'];
const shortName:Record<string,string>={sunday:'주일',afternoon:'오후',friday:'금요',dawn:'새벽'};
const statusName=(status:string)=>status==='published'?'공개':status==='archived'?'공개 안 함':'임시 저장';
const dayLabel=(date:string)=>{const [,m,d]=date.split('-').map(Number);const w=weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];return `${m}월 ${d}일 (${w})`;};

function shift(month:string,delta:number){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7);}

/** Month grid of registered videos. Picking a day lists that day's videos under the grid; a video opens the editor. */
export default function VideoCalendar({month,onMonth,rows,filter,onFilter,onOpen,busy}:{month:string;onMonth:(month:string)=>void;rows:WorshipEntry[];filter:string;onFilter:(filter:string)=>void;onOpen:(row:WorshipEntry)=>void;busy:boolean}){
 const [picked,setPicked]=useState<string|null>(null);
 const [year,mon]=month.split('-').map(Number);
 const first=new Date(Date.UTC(year,mon-1,1)).getUTCDay(),days=new Date(Date.UTC(year,mon,0)).getUTCDate();
 const cells=Array.from({length:Math.ceil((first+days)/7)*7},(_,i)=>i-first+1);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const byDay=new Map<string,WorshipEntry[]>();
 for(const row of rows){if(!row.service_date.startsWith(month))continue;byDay.set(row.service_date,[...(byDay.get(row.service_date)??[]),row]);}
 const selected=picked&&picked.startsWith(month)?picked:null;
 const listed=selected?byDay.get(selected)??[]:[...byDay.entries()].sort(([a],[b])=>a.localeCompare(b)).flatMap(([,list])=>list);
 const move=(delta:number)=>{onMonth(shift(month,delta));setPicked(null);};
 return <section id="video-calendar" tabIndex={-1} className={css.calendar} aria-label="영상 캘린더">
  <div className={css.head}>
   <div className={css.monthNav}>
    <button type="button" className={btn.icon} aria-label="이전 달" onClick={()=>move(-1)}><AdminIcon name="back" size={18}/></button>
    <h2>{year}년 {mon}월</h2>
    <button type="button" className={btn.icon} aria-label="다음 달" onClick={()=>move(1)}><AdminIcon name="back" size={18} style={{transform:'rotate(180deg)'}}/></button>
    <button type="button" className={`${btn.btn} ${btn.small}`} disabled={month===today.slice(0,7)&&!selected} onClick={()=>{onMonth(today.slice(0,7));setPicked(today);}}>오늘</button>
   </div>
   <div className={btn.chips} role="group" aria-label="캘린더 예배 종류 필터">{[{key:'all',name:'전체'},...worshipTypes].map(row=><button key={row.key} type="button" aria-pressed={filter===row.key} onClick={()=>onFilter(row.key)}>{row.key==='all'?'전체':shortName[row.key]}</button>)}</div>
  </div>
  <div className={css.grid} role="grid" aria-label={`${year}년 ${mon}월 영상`}>
   {weekdays.map((day,i)=><div key={day} role="columnheader" className={css.weekday} data-sunday={i===0}>{day}</div>)}
   {cells.map((day,i)=>{const date=day>0&&day<=days?`${month}-${String(day).padStart(2,'0')}`:'';const list=date?byDay.get(date)??[]:[];
    if(!date)return <div key={i} role="gridcell" className={css.cell} data-empty/>;
    return <button key={i} type="button" role="gridcell" className={css.cell} aria-selected={selected===date} aria-label={`${dayLabel(date)} 영상 ${list.length}개`} data-today={date===today||undefined} data-sunday={i%7===0||undefined} onClick={()=>setPicked(selected===date?null:date)}>
     <span className={css.day}>{day}</span>
     <span className={css.tags}>{list.slice(0,3).map(row=><span key={row.id} className={css.tag} data-type={row.service_type} data-status={row.status}>{shortName[row.service_type]??''}</span>)}{list.length>3?<span className={css.more}>+{list.length-3}</span>:null}</span>
    </button>;})}
  </div>
  <div className={css.dayList}>
   <div className={css.dayHead}><h3>{selected?dayLabel(selected):`${mon}월 전체`}</h3><span>{listed.length}개</span>{selected?<button type="button" className={`${btn.btn} ${btn.ghost} ${btn.small}`} onClick={()=>setPicked(null)}>{mon}월 전체 보기</button>:null}</div>
   {listed.length?<ul>{listed.map(row=><li key={row.id}><button type="button" disabled={busy} onClick={()=>onOpen(row)}><span className={css.tag} data-type={row.service_type} data-status={row.status}>{shortName[row.service_type]??''}</span><span className={css.rowTitle}><strong>{row.title}</strong><small>{selected?'':dayLabel(row.service_date)+' · '}{statusName(row.status)}{row.featured?' · 대표':''}</small></span><AdminIcon name="edit" size={15}/></button></li>)}</ul>
    :<p className={css.empty}>{selected?'이 날 등록된 영상이 없습니다.':'이 달에 등록된 영상이 없습니다.'}</p>}
  </div>
 </section>;
}
