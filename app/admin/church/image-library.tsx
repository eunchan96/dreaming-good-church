'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {BulletinImageView} from '@/app/bulletin-image';
import SiteIcon from '@/app/site-icon';
import type {BulletinImage} from '@/lib/church';
import styles from './image-library.module.css';
type Props={images:BulletinImage[];busy:boolean;file:File|null;title:string;alt:string;fileInput:RefObject<HTMLInputElement|null>;onTitle:(value:string)=>void;onAlt:(value:string)=>void;onFile:(file:File|null)=>void;onUpload:()=>void;onDelete:(id:string)=>void;onRefresh:()=>void;onCancel:()=>void};
function FilePreview({file}:{file:File}){
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{const url=URL.createObjectURL(file);if(image.current)image.current.src=url;return()=>URL.revokeObjectURL(url);},[file]);
 // eslint-disable-next-line @next/next/no-img-element -- Local file preview never goes through image optimization.
 return <img ref={image} alt="올릴 이미지 확인"/>;
}

export default function ImageLibrary({images,busy,file,title,alt,fileInput,onTitle,onAlt,onFile,onUpload,onDelete,onRefresh,onCancel}:Props){
 const [adding,setAdding]=useState(false),[query,setQuery]=useState(''),[selected,setSelected]=useState<BulletinImage|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null);

 const filtered=images.filter(image=>(image.title+' '+image.alt).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 function choose(file:File|null){onFile(file);if(file&&!title.trim())onTitle(file.name.replace(/\.[^.]+$/,''));}
 function close(){dialog.current?.close();setSelected(null);previous.current?.focus();}
 return <div className={styles.library}><div className={styles.toolbar}><div><h2>이미지 보관함 <span>{images.length}</span></h2></div><div className={styles.actions}><button type="button" aria-label="이미지 목록 새로고침" title="이미지 목록 새로고침" disabled={busy} onClick={onRefresh}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></svg></button><button type="button" disabled={busy} aria-expanded={adding} aria-controls="church-image-upload" onClick={()=>setAdding(!adding)}>{adding?'접기':'+ 이미지 추가'}</button></div></div>
 {adding?<fieldset id="church-image-upload" disabled={busy} className={styles.upload}><div className={styles.fileArea}><button type="button" aria-label={file?'이미지 바꾸기':undefined} onClick={()=>fileInput.current?.click()}>{file?<FilePreview file={file}/>:<><SiteIcon name="diagonal" size={24}/><span>기기에서 선택</span><small>JPEG · PNG · WebP / 8MB 이하</small></>}</button><input hidden aria-label="이미지 파일" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0]??null)}/></div><div className={styles.uploadFields}><label htmlFor="asset-title">제목</label><input id="asset-title" aria-label="이미지 제목" maxLength={200} value={title} onChange={e=>onTitle(e.target.value)}/><label htmlFor="asset-alt">설명</label><input id="asset-alt" aria-label="이미지 설명 (대체텍스트)" placeholder="사진에 담긴 모습을 짧게 적어 주세요" maxLength={500} value={alt} onChange={e=>onAlt(e.target.value)}/><div className={styles.uploadActions}><span>{file?.name}</span><button type="button" disabled={!file&&!title&&!alt} onClick={onCancel}>취소</button><button type="button" className={styles.primary} disabled={!file||!title.trim()||!alt.trim()} onClick={onUpload}>이미지 올리기</button></div></div></fieldset>:null}
 {images.length?<input className={styles.search} type="search" aria-label="보관함 이미지 검색" placeholder="이미지 검색" value={query} onChange={e=>setQuery(e.target.value)}/>:null}
 <div className={styles.grid}>{filtered.map(image=><article key={image.id}><button type="button" className={styles.thumbnail} aria-label={`${image.title} 크게 보기`} onClick={e=>{previous.current=e.currentTarget;setSelected(image);dialog.current?.showModal();}}><BulletinImageView id={image.id} alt={image.alt} editor/></button><div className={styles.caption}><div><strong>{image.title}</strong><small>{image.width} × {image.height} · {Math.round(image.bytes/1024)}KB</small></div><button type="button" className={styles.delete} disabled={busy} aria-label={`${image.title} 이미지 삭제`} title="이미지 삭제" onClick={()=>onDelete(image.id)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg></button></div></article>)}</div>
 {!filtered.length?<p className={styles.empty}>{images.length?'검색 결과가 없습니다.':'아직 보관된 이미지가 없습니다.'}</p>:null}
 <dialog ref={dialog} className={styles.preview} aria-label="보관함 이미지 확인" onCancel={close} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}><div className={styles.previewHeading}><strong>{selected?.title}</strong><button type="button" aria-label="이미지 확인 닫기" onClick={close}><SiteIcon name="close"/></button></div>{selected?<><BulletinImageView id={selected.id} alt={selected.alt} editor/><p>{selected.alt}</p></>:null}</dialog>
 </div>;
}
