'use client';
import {useId,useRef,type ButtonHTMLAttributes} from 'react';
import styles from './save-button.module.css';
type Props=ButtonHTMLAttributes<HTMLButtonElement>&{disabledHint?:string};
export default function SaveButton({disabled,disabledHint='현재 최신 상태입니다.',children,...props}:Props){
 const hint=useId(),anchor=useRef<HTMLSpanElement>(null),tooltip=useRef<HTMLSpanElement>(null);
 function position(){if(!anchor.current||!tooltip.current)return;tooltip.current.style.display='block';const box=anchor.current.getBoundingClientRect(),width=tooltip.current.offsetWidth;const left=Math.max(12-box.left,Math.min((box.width-width)/2,window.innerWidth-12-box.left-width));tooltip.current.style.left=`${left}px`;tooltip.current.style.display='';}

 return <span ref={anchor} className={styles.wrap} onMouseEnter={position} onFocus={position} tabIndex={disabled?0:undefined} aria-describedby={disabled?hint:undefined}><button {...props} type={props.type??'button'} disabled={disabled} aria-describedby={disabled?hint:undefined}>{children}</button>{disabled?<span ref={tooltip} id={hint} role="tooltip" className={styles.hint}>{disabledHint}</span>:null}</span>;
}
