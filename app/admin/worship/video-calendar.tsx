'use client';
import {worshipTypes} from '@/lib/site-content';
import type {WorshipEntry} from '@/lib/worship-library';
import AdminIcon from '../admin-icons';
import css from './video-calendar.module.css';

const weekdays=['일','월','화','수','목','금','토'];
const shortName:Record<string,string>={sunday:'주일',afternoon:'오후',friday:'금요',dawn:'새벽'};

function shift(month:string,delta:number){const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7);}

/** Month grid of registered videos; each entry opens the editor. */
export default function VideoCalendar({month,onMonth,rows,filter,onFilter,onOpen,busy}:{month:string;onMonth:(month:string)=>void;rows:WorshipEntry[];filter:string;onFilter:(filter:string)=>void;onOpen:(row:WorshipEntry)=>void;busy:boolean}){
 const [year,mon]=month.split('-').map(Number);
 const first=new Date(Date.UTC(year,mon-1,1)).getUTCDay(),days=new Date(Date.UTC(year,mon,0)).getUTCDate();
 const cells=Array.from({length:Math.ceil((first+days)/7)*7},(_,i)=>i-first+1);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const byDay=new Map<string,WorshipEntry[]>();
 for(const row of rows){if(!row.service_date.startsWith(month))continue;byDay.set(row.service_date,[...(byDay.get(row.service_date)??[]),row]);}
 const count=[...byDay.values()].reduce((sum,list)=>sum+list.length,0);
 return <section id="video-calendar" tabIndex={-1} className={css.calendar} aria-label="영상 캘린더">
  <div className={css.head}>
   <div className={css.monthNav}><button type="button" aria-label="이전 달" onClick={()=>onMonth(shift(month,-1))}><AdminIcon name="back" size={16}/></button><h2>{year}년 {mon}월</h2><button type="button" aria-label="다음 달" onClick={()=>onMonth(shift(month,1))}><AdminIcon name="back" size={16} style={{transform:'rotate(180deg)'}}/></button><button type="button" className={css.today} onClick={()=>onMonth(today.slice(0,7))}>이번 달</button></div>
   <p>{count}개 영상</p>
  </div>
  <div className={css.chips} role="group" aria-label="캘린더 예배 종류 필터">{[{key:'all',name:'모든 예배'},...worshipTypes].map(row=><button key={row.key} type="button" aria-pressed={filter===row.key} onClick={()=>onFilter(row.key)}>{row.name}</button>)}</div>
  <div className={css.grid} role="grid" aria-label={`${year}년 ${mon}월 영상`}>
   {weekdays.map((day,i)=><div key={day} role="columnheader" className={css.weekday} data-sunday={i===0}>{day}</div>)}
   {cells.map((day,i)=>{const date=day>0&&day<=days?`${month}-${String(day).padStart(2,'0')}`:'';const list=date?byDay.get(date)??[]:[];
    return <div key={i} role="gridcell" className={css.cell} data-empty={!date} data-today={date===today} data-sunday={i%7===0}>
     {date?<span className={css.day}>{day}</span>:null}
     {list.map(row=><button key={row.id} type="button" disabled={busy} className={css.event} data-type={row.service_type} data-status={row.status} title={`${worshipTypes.find(w=>w.key===row.service_type)?.name??''} · ${row.title}`} onClick={()=>onOpen(row)}><b>{shortName[row.service_type]??''}</b><span>{row.title}</span></button>)}
    </div>;})}
  </div>
 </section>;
}
