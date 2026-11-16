'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import type {BulletinItem} from '@/lib/bulletins';
import {makeBrowserClient} from '@/lib/bulletin-store';
import css from './print-preview.module.css';

type FontStyle={size?:number;bold?:boolean;color?:string;align?:'left'|'center'|'right'};
const palette:[string,string][]=[['먹색','#342b25'],['검정','#111111'],['회색','#6b6660'],['갈색','#866738'],['황토','#a8741a'],['주황','#d4711c'],['벽돌색','#9b3434'],['빨강','#cf2e2e'],['분홍','#c2457a'],['보라','#6a3f8f'],['남색','#23408e'],['파랑','#1f5fae'],['하늘','#2b86c0'],['청록','#16807a'],['녹색','#365a4a'],['초록','#0b7d38'],['올리브','#6f7f22']];
const colors=palette.map(([,value])=>value);
const sizes=[8,8.5,9,10,11,12,14,16,18,22,26];
type Selection={id:string;label:string};
type Context={formats:Record<string,FontStyle>;select:(value:Selection)=>void;editable:boolean;replace:(item:BulletinItem)=>void;toolbar?:ReactNode;plain?:boolean;webFormats?:boolean};
export const PrintContext=createContext<Context>({formats:{},select:()=>{},editable:false,replace:()=>{}});
export type PrintFormats=Record<string,FontStyle>;
/** Keep only known values (sizes, palette colors, alignments) from stored or received formats. */
export function cleanFormats(raw:unknown):PrintFormats{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 return Object.fromEntries(Object.entries(raw).slice(0,3000).map(([id,value])=>{const v=value as FontStyle;return [id,{...(sizes.includes(v?.size??0)?{size:v.size}:{}),...(typeof v?.bold==='boolean'?{bold:v.bold}:{}),...(colors.includes(v?.color??'')?{color:v.color}:{}),...(['left','center','right'].includes(v?.align??'')?{align:v.align}:{})}] as const;}).filter(([,v])=>Object.keys(v).length));
}
function loadFormats(key:string):PrintFormats{try{return cleanFormats(JSON.parse(localStorage.getItem(key)??'{}'));}catch{return {};}}
const Icon=({d,size=16}:{d:string;size?:number})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
const chevron='M6 9l6 6 6-6';
const alignIcons={left:'M4 6h16M4 10h10M4 14h16M4 18h10',center:'M4 6h16M7 10h10M4 14h16M7 18h10',right:'M4 6h16M10 10h10M4 14h16M10 18h10'} as const;

/**
 * Print formats per bulletin. Saved in the DB (bulletin_print_formats) so the public bulletin shows the same look;
 * this browser keeps a copy so the editor opens instantly. `initialFormats` (public pages) skips the DB entirely.
 */
export function PrintEditorProvider({bulletinId,editable,onReplace,children,plain=false,webFormats=false,initialFormats}:{bulletinId:string;editable:boolean;onReplace:(item:BulletinItem)=>void;children:ReactNode;plain?:boolean;webFormats?:boolean;initialFormats?:PrintFormats}){
 const key=`church-bulletin-print-v1:${bulletinId}`,remote=!initialFormats;
 const [formats,setFormats]=useState<PrintFormats>(()=>initialFormats?cleanFormats(initialFormats):loadFormats(key)),[selected,setSelected]=useState<Selection|null>(null),[notice,setNotice]=useState('');
 const [client]=useState(()=>remote?makeBrowserClient():null),saveTimer=useRef<number|undefined>(undefined);
 const current=selected?formats[selected.id]??{}:{};
 // Load the saved formats; if only this browser has some (from before DB saving), upload them once.
 useEffect(()=>{if(!client)return;let active=true;void client.from('bulletin_print_formats').select('formats').eq('bulletin_id',bulletinId).maybeSingle().then(({data,error})=>{if(!active||error)return;const saved=cleanFormats(data?.formats);const local=loadFormats(key);
  if(Object.keys(saved).length){setFormats(saved);try{localStorage.setItem(key,JSON.stringify(saved));}catch{}}
  else if(Object.keys(local).length&&editable)void client.from('bulletin_print_formats').upsert({bulletin_id:bulletinId,formats:local,updated_at:new Date().toISOString()});});return()=>{active=false;};},[client,bulletinId,key,editable]);
 // Other previews of the same bulletin (e.g. the web preview) pick up format changes right away.
 useEffect(()=>{if(!remote)return;const sync=(e:Event)=>{if((e as CustomEvent<string>).detail===key)setFormats(loadFormats(key));};window.addEventListener('print-formats',sync);return()=>window.removeEventListener('print-formats',sync);},[key,remote]);
 function store(next:PrintFormats){setFormats(next);try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new CustomEvent('print-formats',{detail:key}));}catch{}
  if(!client)return;window.clearTimeout(saveTimer.current);saveTimer.current=window.setTimeout(()=>{void client.from('bulletin_print_formats').upsert({bulletin_id:bulletinId,formats:next,updated_at:new Date().toISOString()}).then(({error})=>setNotice(error?'서식을 저장하지 못했습니다. 연결을 확인해 주세요.':''));},500);}
 function format(changes:FontStyle){if(!selected)return;const merged:FontStyle={...current,...changes};if(merged.size===undefined)delete merged.size;store({...formats,[selected.id]:merged});}
 function reset(){if(!selected)return;const next={...formats};delete next[selected.id];store(next);}
 const toolbar=<div className={css.formatBar} role="group" aria-label="인쇄 서식 도구">
  <span className={css.selection} data-empty={!selected||undefined}>{selected?.label??'서식을 바꿀 문단이나 칸을 누르세요'}</span>
  <span className={css.tools}>
   <span className={css.selectWrap}><select aria-label="인쇄 글자 크기" disabled={!selected} value={current.size??''} onChange={e=>format({size:e.target.value?Number(e.target.value):undefined})}><option value="">기본 크기</option>{sizes.map(size=><option value={size} key={size}>{size}pt</option>)}</select><Icon d={chevron} size={14}/></span>
   <button type="button" className={css.iconTool} aria-label="굵게" title="굵게" aria-pressed={current.bold??false} disabled={!selected} onClick={()=>format({bold:!current.bold})}><Icon d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/></button>
   <ColorPicker disabled={!selected} value={current.color??'#342b25'} onChange={color=>format({color})}/>
   <span className={css.segment} role="group" aria-label="인쇄 문단 정렬">{(['left','center','right'] as const).map(align=><button key={align} type="button" className={css.iconTool} aria-label={align==='left'?'왼쪽 정렬':align==='center'?'가운데 정렬':'오른쪽 정렬'} title={align==='left'?'왼쪽':align==='center'?'가운데':'오른쪽'} aria-pressed={(current.align??'left')===align} disabled={!selected} onClick={()=>format({align})}><Icon d={alignIcons[align]}/></button>)}</span>
   <button type="button" className={css.resetTool} disabled={!selected} onClick={reset}><Icon d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" size={14}/>초기화</button>
  </span>
  {notice?<p role="status">{notice}</p>:null}</div>;
 return <PrintContext value={{formats,select:setSelected,editable,replace:onReplace,toolbar,plain,webFormats}}>{children}</PrintContext>;
}
/** Color dropdown: each choice shows its actual color as a dot beside the name. */
function ColorPicker({value,disabled,onChange}:{value:string;disabled:boolean;onChange:(color:string)=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null);
 const current=palette.find(([,color])=>color===value)??palette[0];
 useLayoutEffect(()=>{if(!open)return;const away=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);button.current?.focus();}};document.addEventListener('pointerdown',away);document.addEventListener('keydown',key,true);root.current?.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus();return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',key,true);};},[open]);
 return <span ref={root} className={css.colorPicker}>
  <button ref={button} type="button" aria-label={`인쇄 글자 색상 ${current[0]}`} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} className={css.colorButton} onClick={()=>setOpen(!open)}><span className={css.colorDot} style={{background:current[1]}} aria-hidden="true"/>{current[0]}<span className={css.colorCaret}><Icon d={chevron} size={14}/></span></button>
  {open?<span role="listbox" aria-label="인쇄 글자 색상" className={css.colorList}>{palette.map(([label,color])=><button key={color} type="button" role="option" aria-selected={color===value} onClick={()=>{onChange(color);setOpen(false);button.current?.focus();}}><span className={css.colorDot} style={{background:color}} aria-hidden="true"/>{label}</button>)}</span>:null}
 </span>;
}
export function PrintFormatToolbar(){return useContext(PrintContext).toolbar;}
export function PrintText({id,label,value,onChange,maxLength=20000,className,numeric=false}:{id:string;label:string;value:string;onChange?:(value:string)=>void;maxLength?:number;className?:string;numeric?:boolean}){
 const {formats,select,editable,plain,webFormats}=useContext(PrintContext),ref=useRef<HTMLDivElement>(null),style=formats[id]??{};
 const canEdit=editable&&!!onChange;
 useLayoutEffect(()=>{if(ref.current&&ref.current.innerText.replace(/\r/g,'')!==value)ref.current.innerText=value;},[value]);
 const cssStyle:CSSProperties={...(style.size?{fontSize:`${style.size}pt`}:{}),...(style.bold!==undefined?{fontWeight:style.bold?700:400}:{}),color:style.color,textAlign:style.align};
 function changed(){if(!ref.current)return;let text=ref.current.innerText.replace(/\r/g,'').replace(/\u00a0/g,' ');if(numeric&&!/^\d{0,12}$/.test(text.replace(/[,원\s]/g,''))){ref.current.innerText=value;return;}if(text.length>maxLength){text=text.slice(0,maxLength);ref.current.innerText=text;}if(text!==value)onChange?.(text);}
 // Admin web preview shows the print formats saved in this browser; sizes scale from the 8.5pt print base.
 // The public site has no access to them (they live in this browser only).
 if(plain){const web:CSSProperties|undefined=webFormats?{...(style.size?{fontSize:`${(style.size/8.5).toFixed(3)}em`}:{}),...(style.bold!==undefined?{fontWeight:style.bold?700:400}:{}),color:style.color,textAlign:style.align}:undefined;return <div className={`${css.printText} ${className??''}`} style={web} data-empty={!value}>{value}</div>;}
 return <div ref={ref} className={`${css.printText} ${className??''}`} style={cssStyle} tabIndex={0} role="textbox" aria-readonly={!canEdit} aria-label={label} aria-multiline="true" data-print-field={id} data-empty={!value} contentEditable={canEdit?'plaintext-only':false} suppressContentEditableWarning onFocus={()=>select({id,label})} onClick={()=>select({id,label})} onInput={changed} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase()))e.preventDefault();}} onPaste={e=>{if(!canEdit)return;e.preventDefault();const selection=window.getSelection();if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!ref.current?.contains(range.commonAncestorContainer))return;range.deleteContents();const text=document.createTextNode(e.clipboardData.getData('text/plain'));range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);changed();}}/>;
}
