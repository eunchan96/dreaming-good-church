'use client';
import {useEffect,useRef,useState,type DragEvent} from 'react';
import {BulletinImageView} from '@/app/bulletin-image';
import {makeBrowserClient} from '@/lib/bulletin-store';
import type {BulletinImage} from '@/lib/church';
import {checkImageFile,folderNames,listImages,uploadImage} from '@/lib/image-upload';
import AdminIcon from './admin-icons';
import css from './image-chooser.module.css';

type Props={onClose:()=>void;onPick:(images:BulletinImage[])=>void;attached?:string[]};

/** One place to add images: upload from the device (drop or pick) or reuse one from the library. */
export default function ImageChooser({onClose,onPick,attached=[]}:Props){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 const [client]=useState(makeBrowserClient);
 const [images,setImages]=useState<BulletinImage[]|null>(null),[query,setQuery]=useState(''),[uploading,setUploading]=useState(0),[error,setError]=useState(''),[over,setOver]=useState(false),[folder,setFolder]=useState<string|null>(null);
 useEffect(()=>{const element=dialog.current!;element.showModal();return()=>element.close();},[]);
 useEffect(()=>{let active=true;if(client)listImages(client).then(rows=>{if(active)setImages(rows);},e=>{if(active){setImages([]);setError((e as Error).message);}});return()=>{active=false;};},[client]);
 const close=()=>{if(!uploading)onClose();};
 async function upload(files:File[]){
  if(!client||!files.length||uploading)return;
  const problem=files.map(checkImageFile).find(Boolean);if(problem){setError(problem);return;}
  setError('');setUploading(files.length);const done:BulletinImage[]=[];
  try{for(const file of files){done.push(await uploadImage(client,file,{folder:folder??''}));setUploading(n=>n-1);}}
  catch(e){setError((e as Error).message);}
  finally{setUploading(0);if(input.current)input.current.value='';}
  if(done.length){onPick(done);onClose();}
 }
 const drop=(e:DragEvent)=>{e.preventDefault();setOver(false);void upload([...e.dataTransfer.files]);};
 const words=query.trim().toLocaleLowerCase();
 const folders=folderNames(images??[]);
 const shown=(images??[]).filter(image=>(folder===null||(image.folder??'')===folder)&&(!words||`${image.title} ${image.alt}`.toLocaleLowerCase().includes(words)));
 return <dialog ref={dialog} className={css.dialog} aria-labelledby="image-chooser-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
  <div className={css.inner}>
   <header className={css.head}><h2 id="image-chooser-title">이미지 추가</h2><button type="button" className={css.close} aria-label="이미지 추가 닫기" disabled={!!uploading} onClick={close}><AdminIcon name="remove" size={18}/></button></header>
   <div className={css.drop} data-over={over||undefined} data-busy={!!uploading||undefined} onDragOver={e=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={drop}>
    <button type="button" disabled={!!uploading} onClick={()=>input.current?.click()}>
     <AdminIcon name="upload" size={26}/>
     <strong>{uploading?`올리는 중… (${uploading}장 남음)`:'기기에서 이미지 올리기'}</strong>
     <small>{uploading?'잠시만 기다려 주세요':'눌러서 고르거나 여기로 끌어다 놓으세요 · JPEG·PNG·WebP, 8MB 이하'}</small>
    </button>
    <input ref={input} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="올릴 이미지 파일" onChange={e=>void upload([...(e.target.files??[])])}/>
   </div>
   {error?<p role="alert" className={css.error}>{error}</p>:null}
   <section className={css.library} aria-labelledby="image-chooser-library">
    <div className={css.libraryHead}><h3 id="image-chooser-library">보관함에서 고르기 {images?<span>{images.length}</span>:null}</h3>{images?.length?<label className={css.search}><AdminIcon name="search" size={16}/><input type="search" aria-label="보관함 이미지 검색" placeholder="이름으로 찾기" value={query} onChange={e=>setQuery(e.target.value)}/></label>:null}</div>
    {folders.length?<div className={css.folders} role="group" aria-label="폴더"><button type="button" aria-pressed={folder===null} onClick={()=>setFolder(null)}>전체</button>{folders.map(name=><button key={name} type="button" aria-pressed={folder===name} onClick={()=>setFolder(name)}>{name}</button>)}</div>:null}
    {images===null?<p className={css.empty}>불러오는 중…</p>:shown.length?<ul className={css.grid}>{shown.map(image=>{const used=attached.includes(image.id);return <li key={image.id}><button type="button" disabled={used||!!uploading} aria-label={used?`${image.title} (이미 추가됨)`:`${image.title} 추가`} onClick={()=>{onPick([image]);onClose();}}><span className={css.thumb}><BulletinImageView id={image.id} alt="" editor fallback={<AdminIcon name="image" size={22}/>}/>{used?<em>추가됨</em>:null}</span><span className={css.name}>{image.title}</span></button></li>;})}</ul>:<p className={css.empty}>{images.length?'찾는 이미지가 없습니다.':'아직 보관된 이미지가 없습니다. 위에서 올려 주세요.'}</p>}
   </section>
  </div>
 </dialog>;
}
