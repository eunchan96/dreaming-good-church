'use client';
import {forwardRef,useImperativeHandle,useRef,useState} from 'react';
import AdminIcon from '../admin-icons';
import css from './row-editor.module.css';

export type EditableTextHandle={open:()=>void};
type Props={value:string;label:string;onChange:(value:string)=>void;disabled?:boolean;maxLength?:number;brackets?:boolean;className?:string};

/** Fixed wording shown as plain text; a pencil icon appears on hover/focus and opens a small editor. */
const EditableText=forwardRef<EditableTextHandle,Props>(function EditableText({value,label,onChange,disabled=false,maxLength=500,brackets=false,className},ref){
 const dialog=useRef<HTMLDialogElement>(null),button=useRef<HTMLButtonElement>(null),[draft,setDraft]=useState('');
 const close=()=>{dialog.current?.close();button.current?.focus();};
 const open=()=>{setDraft(value);dialog.current?.showModal();};
 useImperativeHandle(ref,()=>({open}));
 return <><span className={`${css.editable} ${className??''}`} data-empty={!value}><span>{brackets?`〈${value||'항목'}〉`:value||'········'}</span><button ref={button} type="button" disabled={disabled} className={css.editLink} aria-label={label} title="수정" onClick={open}><AdminIcon name="edit" size={14}/></button></span><dialog ref={dialog} className={css.dialog} aria-label="항목 수정" onCancel={()=>button.current?.focus()}><h3>항목 수정</h3><label>내용<textarea aria-label="수정 내용" value={draft} maxLength={maxLength} onChange={e=>setDraft(e.target.value)}/></label><div><button type="button" onClick={close}>취소</button><button type="button" onClick={()=>{onChange(draft);close();}}>적용</button></div></dialog></>;
});
export default EditableText;
