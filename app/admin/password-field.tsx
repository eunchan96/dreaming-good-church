'use client';
import { useState, type InputHTMLAttributes } from 'react';
import styles from './bulletins/workspace.module.css';
export default function PasswordField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & {label:string}) {
  const [visible,setVisible] = useState(false);
  return <label>{label}<span className={styles.passwordField}><input {...props} aria-label={label} type={visible?'text':'password'} /><button type="button" aria-label={`${label} ${visible?'숨기기':'보기'}`} aria-pressed={visible} disabled={props.disabled} onClick={()=>setVisible(!visible)}>{visible?'숨김':'보기'}</button></span></label>;
}
