'use client';
import Select from '../select';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {BulletinImageView} from '@/app/bulletin-image';
import SiteIcon from '@/app/site-icon';
import type {BulletinImage} from '@/lib/church';
import {folderNames} from '@/lib/image-upload';
import AdminIcon from '../admin-icons';
import btn from '../buttons.module.css';
import styles from './image-library.module.css';
type Changes={title?:string;alt?:string;folder?:string};
type Props={images:BulletinImage[];busy:boolean;file:File|null;title:string;alt:string;fileInput:RefObject<HTMLInputElement|null>;onTitle:(value:string)=>void;onAlt:(value:string)=>void;onFile:(file:File|null)=>void;onUpload:(folder:string)=>void;onDelete:(id:string)=>void;onEdit:(id:string,changes:Changes)=>Promise<boolean|undefined>;onCancel:()=>void};
function FilePreview({file}:{file:File}){
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{const url=URL.createObjectURL(file);if(image.current)image.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
 // eslint-disable-next-line @next/next/no-img-element -- Local file preview never goes through image optimization.
 return <img ref={image} alt="올릴 이미지 확인"/>;
}
const ALL='\u0000all',NONE='',NEW='\u0000new';

/** 이미지 보관함: cards show name + folder; the detail dialog shows size and edits name · 설명 · 폴더, or deletes. */
export default function ImageLibrary({images,busy,file,title,alt,fileInput,onTitle,onAlt,onFile,onUpload,onDelete,onEdit,onCancel}:Props){
 const [adding,setAdding]=useState(false),[query,setQuery]=useState('');
 const [folder,setFolder]=useState<string>(ALL),[created,setCreated]=useState<string[]>([]),[naming,setNaming]=useState(false),[newName,setNewName]=useState('');
 const [selected,setSelected]=useState<BulletinImage|null>(null),[draft,setDraft]=useState<Required<Changes>>({title:'',alt:'',folder:''});
 const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null);
 const folders=folderNames(images,created);
 const words=query.trim().toLocaleLowerCase();
 const filtered=images.filter(image=>(folder===ALL||(image.folder??'')===folder)&&(image.title+' '+image.alt).toLocaleLowerCase().includes(words));
 const count=(name:string)=>images.filter(image=>(image.folder??'')===name).length;
 function choose(file:File|null){onFile(file);if(file&&!title.trim())onTitle(file.name.replace(/\.[^.]+$/,''));}
 function open(image:BulletinImage,trigger:HTMLElement){previous.current=trigger;setSelected(image);setDraft({title:image.title,alt:image.alt===image.title?'':image.alt,folder:image.folder??''});dialog.current?.showModal();}
 function close(){dialog.current?.close();setSelected(null);previous.current?.focus();}
 function addFolder(){const name=newName.trim().slice(0,40);if(name){setCreated(current=>current.includes(name)?current:[...current,name]);setFolder(name);}setNewName('');setNaming(false);}
 const target=folder===ALL?NONE:folder;
 const changed=!!selected&&(draft.title.trim()!==selected.title||(draft.alt.trim()||draft.title.trim())!==selected.alt||draft.folder!==(selected.folder??''));
 async function save(){if(!selected||!draft.title.trim())return;const ok=await onEdit(selected.id,{title:draft.title.trim(),alt:draft.alt.trim(),folder:draft.folder});if(ok)close();}
 return <div className={styles.library}>
  <div className={styles.toolbar}><h2>이미지 보관함 <span>{images.length}</span></h2><button type="button" className={`${btn.btn} ${adding?'':btn.primary}`} disabled={busy} aria-expanded={adding} aria-controls="church-image-upload" onClick={()=>setAdding(!adding)}>{adding?'접기':<><AdminIcon name="plus" size={15}/>이미지 추가</>}</button></div>
  <div className={styles.folders} role="group" aria-label="폴더">
   <button type="button" aria-pressed={folder===ALL} onClick={()=>setFolder(ALL)}>전체 <small>{images.length}</small></button>
   {folders.map(name=><button key={name} type="button" aria-pressed={folder===name} onClick={()=>setFolder(name)}>{name} <small>{count(name)}</small></button>)}
   {folders.length&&count(NONE)?<button type="button" aria-pressed={folder===NONE} onClick={()=>setFolder(NONE)}>폴더 없음 <small>{count(NONE)}</small></button>:null}
   {naming?<span className={styles.newFolder}><input autoFocus aria-label="새 폴더 이름" maxLength={40} placeholder="폴더 이름" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addFolder();}if(e.key==='Escape'){setNaming(false);setNewName('');}}} onBlur={addFolder}/></span>:<button type="button" className={styles.addFolder} onClick={()=>setNaming(true)}><AdminIcon name="plus" size={13}/>새 폴더</button>}
  </div>
  {adding?<fieldset id="church-image-upload" disabled={busy} className={styles.upload}><div className={styles.fileArea}><button type="button" aria-label={file?'이미지 바꾸기':undefined} onClick={()=>fileInput.current?.click()}>{file?<FilePreview file={file}/>:<><AdminIcon name="upload" size={24}/><span>기기에서 선택</span><small>JPEG · PNG · WebP / 8MB 이하</small></>}</button><input hidden aria-label="이미지 파일" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0]??null)}/></div><div className={styles.uploadFields}><label htmlFor="asset-title">제목</label><input id="asset-title" aria-label="이미지 제목" maxLength={200} value={title} onChange={e=>onTitle(e.target.value)}/><label htmlFor="asset-alt">설명</label><input id="asset-alt" aria-label="이미지 설명 (대체텍스트)" placeholder="비워 두면 제목을 씁니다" maxLength={500} value={alt} onChange={e=>onAlt(e.target.value)}/><div className={styles.uploadActions}><span>{target?`'${target}' 폴더에 올립니다`:file?.name}</span><button type="button" className={`${btn.btn} ${btn.ghost}`} disabled={!file&&!title&&!alt} onClick={onCancel}>취소</button><button type="button" className={`${btn.btn} ${btn.primary}`} disabled={!file} onClick={()=>onUpload(target)}>올리기</button></div></div></fieldset>:null}
  {images.length?<input className={styles.search} type="search" aria-label="보관함 이미지 검색" placeholder="이미지 검색" value={query} onChange={e=>setQuery(e.target.value)}/>:null}
  <div className={styles.grid}>{filtered.map(image=><button type="button" key={image.id} className={styles.card} aria-label={`${image.title}${image.folder?` ${image.folder}`:''} 자세히 보기`} onClick={e=>open(image,e.currentTarget)}>
   <span className={styles.thumbnail}><BulletinImageView id={image.id} alt="" editor fallback={<AdminIcon name="image" size={22}/>}/></span>
   <span className={styles.caption}><strong>{image.title}</strong>{image.folder?<>{' '}<small className={styles.folderChip}>{image.folder}</small></>:null}</span>
  </button>)}</div>
  {!filtered.length?<p className={styles.empty}>{!images.length?'아직 보관된 이미지가 없습니다.':words?'검색 결과가 없습니다.':'이 폴더에 이미지가 없습니다. 위의 이미지 추가로 바로 올릴 수 있습니다.'}</p>:null}
  <dialog ref={dialog} className={styles.preview} aria-label="이미지 상세" onCancel={close} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}>
   <div className={styles.previewHeading}><strong>이미지 상세</strong><button type="button" className={btn.icon} aria-label="이미지 상세 닫기" onClick={close}><SiteIcon name="close"/></button></div>
   {selected?<div className={styles.detail}>
    <div className={styles.detailImage}><BulletinImageView id={selected.id} alt={selected.alt} editor/><small>{selected.width} × {selected.height} · {Math.round(selected.bytes/1024)}KB</small></div>
    <fieldset className={styles.detailFields} disabled={busy}>
     <label>이름<input aria-label="이미지 이름" maxLength={200} value={draft.title} onChange={e=>setDraft(current=>({...current,title:e.target.value}))}/></label>
     <label>설명<input aria-label="이미지 설명" maxLength={500} placeholder="비워 두면 이름을 씁니다" value={draft.alt} onChange={e=>setDraft(current=>({...current,alt:e.target.value}))}/></label>
     <label>폴더<Select aria-label="이미지 폴더" value={draft.folder} onChange={value=>{if(value===NEW){const name=window.prompt('새 폴더 이름 (40자 이하)')?.trim().slice(0,40);if(name){setCreated(current=>current.includes(name)?current:[...current,name]);setDraft(current=>({...current,folder:name}));}return;}setDraft(current=>({...current,folder:value}));}} options={[{value:'',label:'폴더 없음'},...folderNames(images,[...created,draft.folder]).map(name=>({value:name,label:name})),{value:NEW,label:'+ 새 폴더'}]}/></label>
     <div className={styles.detailActions}><button type="button" className={`${btn.btn} ${btn.ghost} ${styles.danger}`} onClick={()=>{const id=selected.id;close();onDelete(id);}}>이미지 삭제</button><button type="button" className={`${btn.btn} ${btn.primary}`} disabled={!changed||!draft.title.trim()} onClick={()=>void save()}>저장</button></div>
    </fieldset>
   </div>:null}
  </dialog>
 </div>;
}
