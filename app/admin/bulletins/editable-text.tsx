'use client';
import {useRef,useState} from 'react';
import css from './row-editor.module.css';
export default function EditableText({value,label,onChange,disabled=false,maxLength=500,brackets=false}:{value:string;label:string;onChange:(value:string)=>void;disabled?:boolean;maxLength?:number;brackets?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),button=useRef<HTMLButtonElement>(null),[draft,setDraft]=useState('');
 const close=()=>{dialog.current?.close();button.current?.focus();};
 return <><span className={css.editable}><span>{brackets?`〈${value||'항목'}〉`:value||'········'}</span><button ref={button} type="button" disabled={disabled} className={css.editLink} aria-label={label} onClick={()=>{setDraft(value);dialog.current?.showModal();}}>수정</button></span><dialog ref={dialog} className={css.dialog} aria-label="항목 수정" onCancel={()=>button.current?.focus()}><h3>항목 수정</h3><label>내용<textarea aria-label="수정 내용" value={draft} maxLength={maxLength} onChange={e=>setDraft(e.target.value)}/></label><div><button type="button" onClick={close}>취소</button><button type="button" onClick={()=>{onChange(draft);close();}}>적용</button></div></dialog></>;
}
