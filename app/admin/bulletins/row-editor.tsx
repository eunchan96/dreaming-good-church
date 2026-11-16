'use client';
import {useRef,useState,type InputHTMLAttributes,type PointerEvent} from 'react';
import type {BulletinItem,BlockContent} from '@/lib/bulletins';
import {offeringTotal} from '@/lib/bulletins';
import {sectionFor,worshipRows,moveRow,offeringSummary,offeringRows} from '@/lib/bulletin-editor';
import {defaultRow,fixedOrderCell,removeContentRow,requiredOrderCell,rowIdentity} from '@/lib/bulletin-defaults.mjs';
import GrowingTextarea from './growing-textarea';
import EditableText,{type EditableTextHandle} from './editable-text';
import AdminIcon from '../admin-icons';
import {MonthPicker} from '../calendar';
import css from './row-editor.module.css';
const strip=(value:string)=>value.replace(/^\s*↑\s*/,'');
type Props={onImported?:()=>void;item:BulletinItem;previous?:BulletinItem;volunteerHint?:string;onChange:(content:BlockContent,body?:string)=>void};

/** Single-line input whose box grows with its text (CSS grid mirror, no measuring). */
function FitInput({value,className,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'>&{value:string}){
 return <span className={`${css.fit} ${className??''}`} data-value={value||props.placeholder||''}><input {...props} className={css.fitInput} size={1} value={value}/></span>;
}

/** Middle of a liturgy row: dotted leaders on both sides, content centred and sized to fit.
 *  Empty → one continuous dotted line with an "추가" hint on hover; the input stays in place
 *  (transparent) so clicking the line starts typing. Same DOM in both states keeps focus. */
function LeaderCell({value,label,fixed,required,disabled,onChange}:{value:string;label:string;fixed:boolean;required:boolean;disabled:boolean;onChange:(value:string)=>void}){
 const editor=useRef<EditableTextHandle>(null),empty=!value.trim();
 return <div className={css.leader} data-empty={empty} data-fixed={fixed} data-required={required&&empty||undefined}>
  <span className={css.dots} aria-hidden="true"/>
  <span className={css.slot}>{fixed?<EditableText ref={editor} value={value} label={label} disabled={disabled} onChange={onChange}/>:<FitInput aria-label={label} disabled={disabled} maxLength={500} value={value} onChange={e=>onChange(e.target.value)}/>}</span>
  <span className={css.dots} aria-hidden="true"/>
  {empty&&!disabled?<span className={css.addHint} aria-hidden="true">+ 추가</span>:null}
  {required&&empty&&!disabled?<span className={css.srOnly}>매주 채워야 하는 칸</span>:null}
  {empty&&fixed?<button type="button" className={css.addCover} disabled={disabled} aria-label={`${label.replace(/ 수정$/,'')} 추가`} onClick={()=>editor.current?.open()}/>:null}
 </div>;
}

export default function RowEditor({item,previous,volunteerHint,onChange,onImported}:Props){
 const order=item.kind==='worship'&&sectionFor(item)==='예배 순서',staff=/섬기는 이들/.test(item.title),volunteer=/봉사위원/.test(item.title),offering=item.kind==='offering';
 const content=order?worshipRows(item):offering?offeringRows(item.content??{}):item.content??{},rows=content.rows??[],prior=previous?(order?worshipRows(previous):offering?offeringRows(previous.content??{}):previous.content??{}):{};
 const root=useRef<HTMLDivElement>(null),source=useRef<number|null>(null),target=useRef<number|null>(null),[over,setOver]=useState<number|null>(null),[status,setStatus]=useState('');
 function change(next:BlockContent){onChange(next,order?'':undefined);}
 function update(index:number,column:number,value:string){change({...content,rows:rows.map((r,i)=>i===index?Array.from({length:offering?2:3},(_,j)=>j===column?(column===0&&/^\s*↑/.test(r[0]??'')?'↑ '+value:value):r[j]??''):r)});}
 function move(from:number,to:number){if(from===to||to<0||to>=rows.length)return;change(moveRow(content,from,to));setStatus(`${from+1}행을 ${to+1}행으로 이동했습니다.`);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-row="${to}"] [data-handle]`)?.focus());}
 function start(index:number,e:PointerEvent<HTMLButtonElement>){if(e.button!==0)return;source.current=index;target.current=index;e.currentTarget.setPointerCapture(e.pointerId);}
 function drag(e:PointerEvent<HTMLButtonElement>){if(source.current===null)return;const node=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-row]');if(node&&root.current?.contains(node)){target.current=Number(node.dataset.row);setOver(target.current);}}
 function end(){if(source.current!==null&&target.current!==null)move(source.current,target.current);source.current=null;target.current=null;setOver(null);}
 function importRow(index:number,from:number){const row=prior.rows?.[from];if(!row)return;change({...content,rows:rows.map((r,i)=>i===index?[...row]:r),disabledRows:[...(content.disabledRows??[]).filter(i=>i!==index),...(prior.disabledRows?.includes(from)?[index]:[])],...(order?{fullRows:[...(content.fullRows??[]).filter(i=>i!==index),...(prior.fullRows?.includes(from)?[index]:[])]}:{})});onImported?.();}
 const picker=useRef<HTMLDialogElement>(null),returnTo=useRef<HTMLElement|null>(null),[picking,setPicking]=useState(0);
 function closePicker(){picker.current?.close();returnTo.current?.focus();}
 const kind=order?'order':offering?'offering':staff?'staff':volunteer?'volunteer':'';
 const columns=offering?['헌금 구분','금액']:staff?['역할','이름']:volunteer?['봉사','이름','날짜']:['예배 순서','진행 내용','담당자'];
 return <div ref={root} className={css.editor} data-order={order}>
  {offering?<div className={css.month}><MonthPicker label="헌금 집계 월" value={content.month??''} onChange={month=>change({...content,month})}/></div>:null}
  {rows.map((row,index)=>{const disabled=content.disabledRows?.includes(index)??false,full=content.fullRows?.includes(index)??false,from=full?(prior.fullRows?.[0]??(prior.rows?.length?0:-1)):(prior.rows?.findIndex(r=>rowIdentity(r[0])===rowIdentity(row[0]))??-1);
   return <div key={index} data-row={index} data-order={order} data-full={full} data-disabled={disabled} data-over={over===index} data-columns={columns.length} className={css.row}>
    <button type="button" data-handle className={css.handle} aria-label={`${item.title} ${index+1}행 이동`} title="드래그하거나 위아래 방향키로 이동" onKeyDown={e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move(index,index+(e.key==='ArrowUp'?-1:1));}}} onPointerDown={e=>start(index,e)} onPointerMove={drag} onPointerUp={end} onPointerCancel={()=>{source.current=null;target.current=null;setOver(null);}}><AdminIcon name="grip" size={16}/></button>
    {order?<button type="button" className={css.standing} aria-pressed={/^\s*↑/.test(row[0]??'')} disabled={disabled} aria-label={`${item.title} ${index+1}행 일어서서`} title="일어서서 표시" onClick={()=>change({...content,rows:rows.map((r,i)=>i===index?[`${/^\s*↑/.test(row[0])?'':'↑ '}${strip(row[0])}`,...r.slice(1)]:r)})}>↑</button>:null}
    {full?<div className={css.full}><EditableText value={strip(row[0]??'')} label={`${item.title} ${index+1}행 내용 수정`} disabled={disabled} onChange={value=>update(index,0,value)}/></div>
    :order?<div className={css.liturgy}>
      <div className={css.name}><EditableText value={strip(row[0]??'')} label={`${item.title} ${index+1}행 이름 수정`} disabled={disabled} onChange={value=>update(index,0,value)}/></div>
      <LeaderCell value={row[1]??''} label={fixedOrderCell(row,1)?`${item.title} ${index+1}행 진행 내용 수정`:`${item.title} ${index+1}행 진행 내용`} fixed={fixedOrderCell(row,1)} required={requiredOrderCell(row)} disabled={disabled} onChange={value=>update(index,1,value)}/>
      <div className={css.person}>{fixedOrderCell(row,2)?<EditableText value={row[2]??''} label={`${item.title} ${index+1}행 담당자 수정`} disabled={disabled} onChange={value=>update(index,2,value)}/>:<FitInput aria-label={`${item.title} ${index+1}행 담당자`} disabled={disabled} maxLength={500} placeholder="담당" value={row[2]??''} onChange={e=>update(index,2,e.target.value)}/>}</div>
    </div>
    :<div className={css.cells} data-columns={columns.length}>{columns.map((column,col)=>{
     const label=`${item.title} ${index+1}행 ${column}`,fixed=col===0;
     return <div key={column} className={col===0?css.name:css.cell}>{fixed?<EditableText value={row[0]??''} label={`${item.title} ${index+1}행 이름 수정`} disabled={disabled} onChange={value=>update(index,0,value)}/>:<GrowingTextarea className={staff?css.underlined:''} aria-label={label} disabled={disabled} placeholder={volunteer&&col===1&&rowIdentity(row[0])==='교회청소'?volunteerHint:column} inputMode={offering&&col===1?'numeric':undefined} maxLength={offering&&col===1?12:500} value={row[col]??''} onChange={e=>{if(offering&&col===1&&!/^\d{0,12}$/.test(e.target.value))return;update(index,col,e.target.value);}}/>}</div>;
    })}</div>}
    <div className={css.rowTools}>{prior.rows?.length?<button type="button" aria-label={`${item.title} ${index+1}행 지난 주 가져오기`} title="지난 주 가져오기" onClick={e=>{if(from>=0)importRow(index,from);else{returnTo.current=e.currentTarget;setPicking(index);picker.current?.showModal();}}}><AdminIcon name="undo"/></button>:null}<button type="button" aria-label={`${item.title} ${index+1}행 ${disabled?'활성화':'비활성화'}`} title={disabled?'활성화':'비활성화'} onClick={()=>change({...content,disabledRows:disabled?content.disabledRows?.filter(i=>i!==index):[...(content.disabledRows??[]),index]})}><AdminIcon name={disabled?'on':'off'}/></button>{defaultRow(kind,row)?null:<button type="button" aria-label={`${item.title} ${index+1}행 삭제`} title="행 삭제" onClick={()=>change(removeContentRow(content,index))}><AdminIcon name="remove"/></button>}</div>
   </div>;
  })}
  {order?<div className={css.footer}><EditableText value={content.footer??''} label="일어서서 안내 수정" maxLength={1000} onChange={footer=>change({...content,footer})}/></div>:null}
  <div className={css.addRow}><button type="button" className={css.add} disabled={rows.length>=100} aria-label={`${item.title} 행 추가`} onClick={()=>change({...content,rows:[...rows,Array.from({length:offering?2:3},()=>'')]})}><AdminIcon name="plus" size={14}/>행 추가</button></div>
  {offering?<p className={css.total}>{offeringSummary(content,item.body)} {offeringTotal(content).toLocaleString('ko-KR')}원</p>:null}<span className={css.srOnly} aria-live="polite">{status}</span>
 <dialog ref={picker} className={css.dialog} aria-label="지난 주 행 선택" onCancel={()=>returnTo.current?.focus()}><h3>지난 주 행 선택</h3><div className={css.pickRows}>{prior.rows?.map((row,i)=><button type="button" key={i} onClick={()=>{importRow(picking,i);closePicker();}}>{strip(row[0])||'빈 항목'}{row[1]?` · ${row[1].slice(0,80)}`:''}</button>)}</div><button type="button" onClick={closePicker}>닫기</button></dialog>
 </div>;
}
