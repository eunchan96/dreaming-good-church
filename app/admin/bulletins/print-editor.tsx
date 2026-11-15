'use client';
import {createContext,useContext,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import type {BulletinItem} from '@/lib/bulletins';
import css from './print-preview.module.css';

type FontStyle={size?:number;bold?:boolean;color?:string;align?:'left'|'center'|'right'};
const colors=['#342b25','#866738','#9b3434','#365a4a'];
const sizes=[8,8.5,9,10,11,12,14,16,18,22,26];
type Selection={id:string;label:string};
type Context={formats:Record<string,FontStyle>;select:(value:Selection)=>void;editable:boolean;replace:(item:BulletinItem)=>void;toolbar?:ReactNode;plain?:boolean};
export const PrintContext=createContext<Context>({formats:{},select:()=>{},editable:false,replace:()=>{}});
function loadFormats(key:string):Record<string,FontStyle>{
 try{const raw=JSON.parse(localStorage.getItem(key)??'{}');if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};return Object.fromEntries(Object.entries(raw).slice(0,3000).map(([id,value])=>{const v=value as FontStyle;return [id,{...(sizes.includes(v?.size??0)?{size:v.size}:{}),...(typeof v?.bold==='boolean'?{bold:v.bold}:{}),...(colors.includes(v?.color??'')?{color:v.color}:{}),...(['left','center','right'].includes(v?.align??'')?{align:v.align}:{})}];}));}catch{return {};}
}
export function PrintEditorProvider({bulletinId,editable,onReplace,children,plain=false}:{bulletinId:string;editable:boolean;onReplace:(item:BulletinItem)=>void;children:ReactNode;plain?:boolean}){
 const key=`church-bulletin-print-v1:${bulletinId}`;
 const [formats,setFormats]=useState(()=>loadFormats(key)),[selected,setSelected]=useState<Selection|null>(null),[notice,setNotice]=useState('');
 const current=selected?formats[selected.id]??{}:{};
 function format(changes:FontStyle){if(!selected)return;const merged:FontStyle={...current,...changes};if(merged.size===undefined)delete merged.size;const next={...formats,[selected.id]:merged};setFormats(next);try{localStorage.setItem(key,JSON.stringify(next));setNotice('');}catch{setNotice('서식을 보관하지 못했습니다. 현재 미리보기에는 적용됩니다.');}}
 function reset(){if(!selected)return;const next={...formats};delete next[selected.id];setFormats(next);try{localStorage.setItem(key,JSON.stringify(next));setNotice('');}catch{setNotice('서식을 보관하지 못했습니다.');}}
 const toolbar=<div className={css.formatBar} role="group" aria-label="인쇄 서식 도구"><span className={css.selection}>{selected?.label??'서식을 바꿀 문단이나 칸을 클릭하세요'}</span><label>크기<select aria-label="인쇄 글자 크기" disabled={!selected} value={current.size??''} onChange={e=>format({size:e.target.value?Number(e.target.value):undefined})}><option value="">기본</option>{sizes.map(size=><option value={size} key={size}>{size}pt</option>)}</select></label><button type="button" aria-label="굵게" aria-pressed={current.bold??false} disabled={!selected} onClick={()=>format({bold:!current.bold})}><b>가</b></button><label>색상<select aria-label="인쇄 글자 색상" disabled={!selected} value={current.color??'#342b25'} onChange={e=>format({color:e.target.value})}>{['먹색','갈색','벽돌색','녹색'].map((label,i)=><option key={label} value={colors[i]}>{label}</option>)}</select></label><label>정렬<select aria-label="인쇄 문단 정렬" disabled={!selected} value={current.align??'left'} onChange={e=>format({align:e.target.value as FontStyle['align']})}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label><button type="button" disabled={!selected} onClick={reset}>서식 초기화</button>{notice?<p role="status">{notice}</p>:null}</div>;
 return <PrintContext value={{formats,select:setSelected,editable,replace:onReplace,toolbar,plain}}>{children}</PrintContext>;
}
export function PrintFormatToolbar(){return useContext(PrintContext).toolbar;}
export function PrintText({id,label,value,onChange,maxLength=20000,className,numeric=false}:{id:string;label:string;value:string;onChange?:(value:string)=>void;maxLength?:number;className?:string;numeric?:boolean}){
 const {formats,select,editable,plain}=useContext(PrintContext),ref=useRef<HTMLDivElement>(null),style=formats[id]??{};
 const canEdit=editable&&!!onChange;
 useLayoutEffect(()=>{if(ref.current&&ref.current.innerText.replace(/\r/g,'')!==value)ref.current.innerText=value;},[value]);
 const cssStyle:CSSProperties={...(style.size?{fontSize:`${style.size}pt`}:{}),...(style.bold!==undefined?{fontWeight:style.bold?700:400}:{}),color:style.color,textAlign:style.align};
 function changed(){if(!ref.current)return;let text=ref.current.innerText.replace(/\r/g,'').replace(/\u00a0/g,' ');if(numeric&&!/^\d{0,12}$/.test(text.replace(/[,원\s]/g,''))){ref.current.innerText=value;return;}if(text.length>maxLength){text=text.slice(0,maxLength);ref.current.innerText=text;}if(text!==value)onChange?.(text);}
 // Print-only formatting (size/colour) never leaks into the web views.
 if(plain)return <div className={`${css.printText} ${className??''}`} data-empty={!value}>{value}</div>;
 return <div ref={ref} className={`${css.printText} ${className??''}`} style={cssStyle} tabIndex={0} role="textbox" aria-readonly={!canEdit} aria-label={label} aria-multiline="true" data-print-field={id} data-empty={!value} contentEditable={canEdit?'plaintext-only':false} suppressContentEditableWarning onFocus={()=>select({id,label})} onClick={()=>select({id,label})} onInput={changed} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase()))e.preventDefault();}} onPaste={e=>{if(!canEdit)return;e.preventDefault();const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!ref.current?.contains(range.commonAncestorContainer))return;range.deleteContents();const text=document.createTextNode(e.clipboardData.getData('text/plain'));range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);changed();}}/>;
}
