'use client';
import {useEffect,useRef,useState} from 'react';
import type {BulletinImage} from '@/lib/church';
import {BulletinImageView} from '@/app/bulletin-image';
import SiteIcon from '@/app/site-icon';
import ui from './workspace.module.css';

export default function ImagePicker({images,onClose,onDefault,onDevice,onSelect}:{images:BulletinImage[];onClose:()=>void;onDefault:()=>void;onDevice:()=>void;onSelect:(image:BulletinImage)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const [library,setLibrary]=useState(false),[limit,setLimit]=useState(20);
 const finish=(action:()=>void)=>{dialog.current?.close();action();};
 useEffect(()=>{const element=dialog.current!,previous=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();return()=>{element.close();document.body.style.overflow=previous;};},[]);
 useEffect(()=>{heading.current?.focus();},[library]);
 return <dialog ref={dialog} aria-labelledby="image-picker-title" className={ui.imagePicker} onCancel={e=>{e.preventDefault();finish(onClose);}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finish(onClose);}}><div className={ui.pickerHeading}><h2 id="image-picker-title" tabIndex={-1} ref={heading}>{library?'보관함에서 가져오기':'이미지 선택'}</h2><button type="button" aria-label="이미지 선택 닫기" onClick={()=>finish(onClose)}><SiteIcon name="close"/></button></div>
  {library?<><button type="button" className={ui.pickerBack} onClick={()=>setLibrary(false)}>선택 방법으로 돌아가기</button>{images.length?<div className={ui.libraryGrid}>{images.slice(0,limit).map(image=><button type="button" key={image.id} aria-label={`${image.title} 선택`} onClick={()=>finish(()=>onSelect(image))}><div><BulletinImageView id={image.id} alt="" editor/></div><span>{image.title}</span></button>)}</div>:<p className={ui.emptyLibrary}>보관된 이미지가 없습니다.</p>}{images.length>limit?<button type="button" onClick={()=>setLimit(n=>n+20)}>더 보기</button>:null}</>:<div className={ui.sourceOptions}><button type="button" onClick={()=>finish(onDefault)}>기본 교회 일러스트</button><button type="button" onClick={()=>finish(onDevice)}>기기에서 가져오기</button><button type="button" onClick={()=>setLibrary(true)}>보관함에서 가져오기</button></div>}
 </dialog>;
}
