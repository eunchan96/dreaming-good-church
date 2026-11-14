'use client';
import {useRef,useState} from 'react';
import styles from './workspace.module.css';
type Range={start:string;end:string};
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export default function DateRange({value,onChange}:{value:Range;onChange:(value:Range)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [draft,setDraft]=useState(value),[month,setMonth]=useState(()=>new Date()),[choosingEnd,setChoosingEnd]=useState(false);
 const first=new Date(month.getFullYear(),month.getMonth(),1),days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 function close(){dialog.current?.close();trigger.current?.focus();}
 function choose(day:string){if(!choosingEnd||!draft.start){setDraft({start:day,end:''});setChoosingEnd(true);}else{setDraft(day<draft.start?{start:day,end:draft.start}:{start:draft.start,end:day});setChoosingEnd(false);}}
 return <><button ref={trigger} className={styles.dateButton} aria-haspopup="dialog" aria-label="날짜 검색" onClick={()=>{setDraft(value);setChoosingEnd(false);setMonth(value.start?new Date(value.start+'T12:00:00'):new Date());dialog.current?.showModal();}}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></svg><span>{value.start?`${value.start} – ${value.end||value.start}`:'날짜'}</span></button>
 <dialog ref={dialog} className={styles.calendar} aria-labelledby="date-range-heading" onCancel={()=>trigger.current?.focus()} onClick={e=>{if(e.target===e.currentTarget)close();}}><div className={styles.calendarBody}><div className={styles.calendarHeading}><h2 id="date-range-heading">날짜 검색</h2><button aria-label="닫기" onClick={close}>×</button></div>
 <div className={styles.rangeInputs}><label>시작 날짜<input type="date" value={draft.start} onChange={e=>{setDraft({start:e.target.value,end:''});setChoosingEnd(true);}}/></label><span>—</span><label>끝 날짜<input type="date" min={draft.start||undefined} value={draft.end} onChange={e=>setDraft(current=>({...current,end:e.target.value}))}/></label></div>
 <div className={styles.month}><button aria-label="이전 달" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button><strong>{month.getFullYear()}년 {month.getMonth()+1}월</strong><button aria-label="다음 달" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button></div>
 <p className={styles.calendarHint} aria-live="polite">{choosingEnd?'끝 날짜를 선택하세요':'시작 날짜를 선택하세요'}</p><div className={styles.days}>{['일','월','화','수','목','금','토'].map(day=><span key={day}>{day}</span>)}{Array.from({length:first.getDay()},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{const day=iso(new Date(month.getFullYear(),month.getMonth(),i+1)),selected=day===draft.start||day===draft.end;return <button key={day} aria-label={`${i+1}, ${month.getFullYear()}년 ${month.getMonth()+1}월`} aria-pressed={selected} data-between={!!draft.start&&!!draft.end&&day>draft.start&&day<draft.end} aria-current={day===iso(new Date())?'date':undefined} onClick={()=>choose(day)}>{i+1}</button>;})}</div>
 <div className={styles.calendarFooter}><button onClick={()=>{onChange({start:'',end:''});close();}}>초기화</button><button disabled={!draft.start||!!draft.end&&draft.end<draft.start} onClick={()=>{onChange({start:draft.start,end:draft.end||draft.start});close();}}>적용</button></div></div></dialog></>;
}
