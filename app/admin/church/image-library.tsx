'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {BulletinImageView} from '@/app/bulletin-image';
import SiteIcon from '@/app/site-icon';
import type {BulletinImage} from '@/lib/church';
import {folderNames} from '@/lib/image-upload';
import AdminIcon from '../admin-icons';
import btn from '../buttons.module.css';
import styles from './image-library.module.css';
type Props={images:BulletinImage[];busy:boolean;file:File|null;title:string;alt:string;fileInput:RefObject<HTMLInputElement|null>;onTitle:(value:string)=>void;onAlt:(value:string)=>void;onFile:(file:File|null)=>void;onUpload:(folder:string)=>void;onDelete:(id:string)=>void;onMove:(id:string,folder:string)=>void;onCancel:()=>void};
function FilePreview({file}:{file:File}){
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{const url=URL.createObjectURL(file);if(image.current)image.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
 // eslint-disable-next-line @next/next/no-img-element -- Local file preview never goes through image optimization.
 return <img ref={image} alt="올릴 이미지 확인"/>;
}
const ALL='\u0000all',NONE='';

/** 이미지 보관함: one-level folders (전체 · 폴더별 · 폴더 없음), upload into the open folder, move by select. */
export default function ImageLibrary({images,busy,file,title,alt,fileInput,onTitle,onAlt,onFile,onUpload,onDelete,onMove,onCancel}:Props){
 const [adding,setAdding]=useState(false),[query,setQuery]=useState(''),[selected,setSelected]=useState<BulletinImage|null>(null);
 const [folder,setFolder]=useState<string>(ALL),[created,setCreated]=useState<string[]>([]),[naming,setNaming]=useState(false),[newName,setNewName]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null);
 const folders=folderNames(images,created);
 const words=query.trim().toLocaleLowerCase();
 const filtered=images.filter(image=>(folder===ALL||(image.folder??'')===folder)&&(image.title+' '+image.alt).toLocaleLowerCase().includes(words));
 const count=(name:string)=>images.filter(image=>(image.folder??'')===name).length;
 function choose(file:File|null){onFile(file);if(file&&!title.trim())onTitle(file.name.replace(/\.[^.]+$/,''));}
 function close(){dialog.current?.close();setSelected(null);previous.current?.focus();}
 function addFolder(){const name=newName.trim().slice(0,40);if(name){setCreated(current=>current.includes(name)?current:[...current,name]);setFolder(name);}setNewName('');setNaming(false);}
 const target=folder===ALL?NONE:folder;
 return <div className={styles.library}>
  <div className={styles.toolbar}><h2>이미지 보관함 <span>{images.length}</span></h2><button type="button" className={`${btn.btn} ${adding?'':btn.primary}`} disabled={busy} aria-expanded={adding} aria-controls="church-image-upload" onClick={()=>setAdding(!adding)}>{adding?'접기':<><AdminIcon name="plus" size={15}/>이미지 추가</>}</button></div>
  <div className={styles.folders} role="group" aria-label="폴더">
   <button type="button" aria-pressed={folder===ALL} onClick={()=>setFolder(ALL)}>전체 <small>{images.length}</small></button>
   {folders.map(name=><button key={name} type="button" aria-pressed={folder===name} onClick={()=>setFolder(name)}><SiteIcon name="book" size={14}/>{name} <small>{count(name)}</small></button>)}
   {folders.length&&count(NONE)?<button type="button" aria-pressed={folder===NONE} onClick={()=>setFolder(NONE)}>폴더 없음 <small>{count(NONE)}</small></button>:null}
   {naming?<span className={styles.newFolder}><input autoFocus aria-label="새 폴더 이름" maxLength={40} placeholder="폴더 이름" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addFolder();}if(e.key==='Escape'){setNaming(false);setNewName('');}}} onBlur={addFolder}/></span>:<button type="button" className={styles.addFolder} onClick={()=>setNaming(true)}><AdminIcon name="plus" size={13}/>새 폴더</button>}
  </div>
  {adding?<fieldset id="church-image-upload" disabled={busy} className={styles.upload}><div className={styles.fileArea}><button type="button" aria-label={file?'이미지 바꾸기':undefined} onClick={()=>fileInput.current?.click()}>{file?<FilePreview file={file}/>:<><AdminIcon name="upload" size={24}/><span>기기에서 선택</span><small>JPEG · PNG · WebP / 8MB 이하</small></>}</button><input hidden aria-label="이미지 파일" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0]??null)}/></div><div className={styles.uploadFields}><label htmlFor="asset-title">제목</label><input id="asset-title" aria-label="이미지 제목" maxLength={200} value={title} onChange={e=>onTitle(e.target.value)}/><label htmlFor="asset-alt">설명</label><input id="asset-alt" aria-label="이미지 설명 (대체텍스트)" placeholder="비워 두면 제목을 씁니다" maxLength={500} value={alt} onChange={e=>onAlt(e.target.value)}/><div className={styles.uploadActions}><span>{target?`'${target}' 폴더에 올립니다`:file?.name}</span><button type="button" className={`${btn.btn} ${btn.ghost}`} disabled={!file&&!title&&!alt} onClick={onCancel}>취소</button><button type="button" className={`${btn.btn} ${btn.primary}`} disabled={!file} onClick={()=>onUpload(target)}>올리기</button></div></div></fieldset>:null}
  {images.length?<input className={styles.search} type="search" aria-label="보관함 이미지 검색" placeholder="이미지 검색" value={query} onChange={e=>setQuery(e.target.value)}/>:null}
  <div className={styles.grid}>{filtered.map(image=><article key={image.id}><button type="button" className={styles.thumbnail} aria-label={`${image.title} 크게 보기`} onClick={e=>{previous.current=e.currentTarget;setSelected(image);dialog.current?.showModal();}}><BulletinImageView id={image.id} alt={image.alt} editor fallback={<AdminIcon name="image" size={22}/>}/></button><div className={styles.caption}><div><strong>{image.title}</strong><small>{image.width} × {image.height} · {Math.round(image.bytes/1024)}KB</small></div><button type="button" className={`${btn.icon} ${styles.delete}`} disabled={busy} aria-label={`${image.title} 이미지 삭제`} title="이미지 삭제" onClick={()=>onDelete(image.id)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg></button></div>
   <label className={styles.move}><span>폴더</span><select aria-label={`${image.title} 폴더`} disabled={busy} value={image.folder??''} onChange={e=>{if(e.target.value==='\u0000new'){const name=window.prompt('새 폴더 이름 (40자 이하)')?.trim().slice(0,40);if(name){setCreated(current=>current.includes(name)?current:[...current,name]);onMove(image.id,name);}return;}onMove(image.id,e.target.value);}}><option value="">폴더 없음</option>{folders.map(name=><option key={name} value={name}>{name}</option>)}<option value={'\u0000new'}>+ 새 폴더…</option></select></label>
  </article>)}</div>
  {!filtered.length?<p className={styles.empty}>{!images.length?'아직 보관된 이미지가 없습니다.':words?'검색 결과가 없습니다.':'이 폴더에 이미지가 없습니다. 위의 이미지 추가로 바로 올릴 수 있습니다.'}</p>:null}
  <dialog ref={dialog} className={styles.preview} aria-label="보관함 이미지 확인" onCancel={close} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}><div className={styles.previewHeading}><strong>{selected?.title}</strong><button type="button" className={btn.icon} aria-label="이미지 확인 닫기" onClick={close}><SiteIcon name="close"/></button></div>{selected?<><BulletinImageView id={selected.id} alt={selected.alt} editor/><p>{selected.alt}</p></>:null}</dialog>
 </div>;
}
