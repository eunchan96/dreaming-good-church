'use client';
import {useLayoutEffect,useRef,type TextareaHTMLAttributes} from 'react';

type Props=Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,'value'>&{value:string};
export default function GrowingTextarea({value,...props}:Props){
 const ref=useRef<HTMLTextAreaElement>(null);
 useLayoutEffect(()=>{
  const node=ref.current;if(!node)return;
  let width=node.clientWidth;
  const fit=()=>{node.style.height='auto';node.style.height=`${node.scrollHeight+2}px`;};
  fit();const observer=new ResizeObserver(()=>{if(width===node.clientWidth)return;width=node.clientWidth;fit();});observer.observe(node);
  return ()=>observer.disconnect();
 },[value]);
 return <textarea {...props} ref={ref} value={value} rows={1} style={{...props.style,overflow:'hidden',resize:'none'}}/>;
}
