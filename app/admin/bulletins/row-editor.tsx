'use client';
import {useRef,useState,type PointerEvent} from 'react';
import type {BulletinItem,BlockContent} from '@/lib/bulletins';
import {offeringTotal} from '@/lib/bulletins';
import {sectionFor,worshipRows,moveRow,offeringSummary,offeringRows} from '@/lib/bulletin-editor';
import GrowingTextarea from './growing-textarea';
import {MonthPicker} from '../calendar';
import css from './row-editor.module.css';

function stripStanding(value:string){return value.replace(/^\s*↑\s*/,'');}

type Props={item:BulletinItem;onChange:(content:BlockContent,body?:string)=>void};
export default function RowEditor({item,onChange}:Props){
 const order=item.kind==='worship'&&sectionFor(item)==='예배 순서';
 const fixed=/기도\s*인도.*안내/.test(item.title);
 const content=order?worshipRows(item):item.kind==='offering'?offeringRows(item.content??{}):item.content??{};
 const original=content.rows??[],rows=fixed?Array.from({length:Math.max(5,original.length)},(_,i)=>original[i]??['','','']):original;
 const columns=item.kind==='offering'?['헌금 구분','금액']:/섬기는 이들/.test(item.title)?['역할','이름']:/봉사위원/.test(item.title)?['봉사','이름','날짜']:fixed?['날짜','기도 인도','안내']:['예배 순서','진행 내용','담당자'];
 const root=useRef<HTMLDivElement>(null),source=useRef<number|null>(null),target=useRef<number|null>(null),dialog=useRef<HTMLDialogElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const [over,setOver]=useState<number|null>(null),[editing,setEditing]=useState(0),[name,setName]=useState(''),[announcement,setAnnouncement]=useState('');
 function change(next:BlockContent){onChange(next,order?'':undefined);}
 function reorder(from:number,to:number){if(from===to||to<0||to>=rows.length)return;change(moveRow({...content,rows},from,to));setAnnouncement(`${from+1}행을 ${to+1}행으로 이동했습니다.`);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-row="${to}"] [data-handle]`)?.focus());}
 function finish(){if(source.current!==null&&target.current!==null)reorder(source.current,target.current);source.current=null;target.current=null;setOver(null);}
 function startDrag(index:number,event:PointerEvent<HTMLButtonElement>){if(event.button!==0)return;source.current=index;target.current=index;event.currentTarget.setPointerCapture(event.pointerId);}
 function pointerMove(event:PointerEvent<HTMLButtonElement>){if(source.current===null)return;const node=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-row]');if(node&&root.current?.contains(node)){target.current=Number(node.dataset.row);setOver(target.current);}}
 function pointerUp(event:PointerEvent<HTMLButtonElement>){if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);finish();}
 function cancelDrag(){source.current=null;target.current=null;setOver(null);}
 function openName(index:number,button:HTMLButtonElement){returnFocus.current=button;setEditing(index);setName((rows[index][0]??'').replace(/^\s*↑\s*/,''));dialog.current?.showModal();}
 function toggleStanding(index:number){change({...content,rows:rows.map((r,i)=>i===index?[`${/^\s*↑/.test(r[0])?'':'↑ '}${stripStanding(r[0])}`,...r.slice(1)]:r)});}
 function toggleRow(index:number){change({...content,rows,disabledRows:content.disabledRows?.includes(index)?content.disabledRows.filter(i=>i!==index):[...(content.disabledRows??[]),index]});}
 const close=()=>{dialog.current?.close();returnFocus.current?.focus();};
 function update(index:number,column:number,value:string){
  const row=rows[index];change({...content,rows:rows.map((r,i)=>i===index?Array.from({length:item.kind==='offering'?2:3},(_,j)=>j===column?(column===0&&/^\s*↑/.test(row[0]??'')?'↑ '+value:value):r[j]??''):r)});
 }
 return <div ref={root} className={css.editor}>
  {item.kind==='offering'?<div className={css.month}><span>집계 월</span><MonthPicker label="헌금 집계 월" value={content.month??''} onChange={value=>change({...content,month:value})}/></div>:null}
  {rows.map((row,index)=><EditableRow key={index} row={row} index={index} title={item.title} kind={item.kind} order={order} fixed={fixed} columns={columns} disabled={content.disabledRows?.includes(index)??false} full={content.fullRows?.includes(index)??false} over={over===index} onMove={reorder} onStart={startDrag} onPointerMove={pointerMove} onPointerUp={pointerUp} onCancel={cancelDrag} onName={openName} onUpdate={update} onStanding={toggleStanding} onToggle={toggleRow}/>)}
  {order&&content.footer?<p className={css.footer}>{content.footer}</p>:null}
  {!fixed?<button className={css.add} type="button" disabled={rows.length>=100} aria-label={`${item.title} 행 추가`} onClick={()=>change({...content,rows:[...rows,Array.from({length:item.kind==='offering'?2:3},()=>'')]})}>행 추가</button>:null}
  {item.kind==='offering'?<p className={css.total}>{offeringSummary(content,item.body)} {offeringTotal(content).toLocaleString('ko-KR')}원</p>:null}
  <span className={css.srOnly} aria-live="polite">{announcement}</span>
  <dialog ref={dialog} className={css.dialog} aria-labelledby={`row-name-${item.id}`} onCancel={()=>returnFocus.current?.focus()}><h3 id={`row-name-${item.id}`}>항목 수정</h3><label>이름<input value={name} maxLength={500} onChange={e=>setName(e.target.value)}/></label><div><button type="button" onClick={close}>취소</button><button type="button" onClick={()=>{update(editing,0,name);close();}}>적용</button></div></dialog>
 </div>;
}

type RowProps={row:string[];index:number;title:string;kind?:string;order:boolean;fixed:boolean;columns:string[];disabled:boolean;full:boolean;over:boolean;onMove:(from:number,to:number)=>void;onStart:(index:number,event:PointerEvent<HTMLButtonElement>)=>void;onPointerMove:(event:PointerEvent<HTMLButtonElement>)=>void;onPointerUp:(event:PointerEvent<HTMLButtonElement>)=>void;onCancel:()=>void;onName:(index:number,button:HTMLButtonElement)=>void;onUpdate:(index:number,column:number,value:string)=>void;onStanding:(index:number)=>void;onToggle:(index:number)=>void};
function EditableRow({row,index,title,kind,order,fixed,columns,disabled,full,over,onMove,onStart,onPointerMove,onPointerUp,onCancel,onName,onUpdate,onStanding,onToggle}:RowProps){
 return <div data-row={index} data-over={over} data-disabled={disabled} data-order={order} data-fixed={fixed} data-columns={columns.length} className={css.row}>
  {!fixed?<button type="button" data-handle className={css.handle} aria-label={`${title} ${index+1}행 이동`} title="드래그하거나 위아래 방향키로 이동" onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();onMove(index,index+(e.key==='ArrowUp'?-1:1));}}} onPointerDown={e=>onStart(index,e)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onCancel}>≡</button>:null}
  {order?<button type="button" className={css.standing} disabled={disabled} aria-label={`${title} ${index+1}행 일어서서`} aria-pressed={/^\s*↑/.test(row[0]??'')} onClick={()=>onStanding(index)}>↑</button>:null}
  {full?<GrowingTextarea className={css.full} aria-label={`${title} ${index+1}행 내용`} disabled={disabled} maxLength={500} value={stripStanding(row[0]??'')} onChange={e=>onUpdate(index,0,e.target.value)}/>:columns.map((column,col)=>col===0&&!fixed?<div className={css.rowName} key={column}><span>{stripStanding(row[0]??'')||'항목'}</span><button type="button" disabled={disabled} aria-label={`${title} ${index+1}행 이름 수정`} onClick={e=>onName(index,e.currentTarget)}>수정</button></div>:<GrowingTextarea key={column} disabled={disabled} aria-label={`${title} ${index+1}행 ${column}`} placeholder={column} inputMode={kind==='offering'&&col===1?'numeric':undefined} maxLength={kind==='offering'&&col===1?12:500} value={row[col]??''} onChange={e=>{if(kind==='offering'&&col===1&&!/^\d{0,12}$/.test(e.target.value))return;onUpdate(index,col,e.target.value);}}/>)}
  {!fixed?<button type="button" className={css.enable} aria-label={`${title} ${index+1}행 ${disabled?'활성화':'비활성화'}`} aria-pressed={!disabled} onClick={()=>onToggle(index)}>{disabled?'활성화':'비활성화'}</button>:null}
 </div>;
}
