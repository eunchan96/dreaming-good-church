'use client';
import {useEffect,useRef,useState} from 'react';
import {makeBrowserClient,errorMessage} from '@/lib/bulletin-store';
import {defaultHomeContent,homeTextLimits,validHomeContent,type HomeContent} from '@/lib/home-content';
import type {BulletinImage} from '@/lib/church';
import AdminShell from '../admin-shell';
import ReauthPanel from '../reauth-panel';
import ImagePicker from './image-picker';
import styles from '../bulletins/workspace.module.css';
import ui from './workspace.module.css';
type Draft=HomeContent&{revision:number};
function editableContent(value:unknown):Draft{
 if(value===null)return {...defaultHomeContent,revision:0};
 if(!validHomeContent(value)||!('revision' in value)||!Number.isInteger(value.revision))throw new Error('Invalid homepage content');
 return {...value,revision:Number(value.revision)};
}
const labels={title_line1:'제목 첫째 줄',title_line2:'제목 둘째 줄',description_line1:'설명 첫째 줄',description_line2:'설명 둘째 줄',link_label:'교회 소개 버튼 문구',footnote:'하단 환영 문구'} as const;
export default function HomeWorkspace(){
 const [client]=useState(makeBrowserClient),[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [draft,setDraft]=useState<Draft>({...defaultHomeContent,revision:0}),[saved,setSaved]=useState<Draft>({...defaultHomeContent,revision:0});
 const [images,setImages]=useState<BulletinImage[]>([]),[file,setFile]=useState<File|null>(null),[imageSrc,setImageSrc]=useState(''),[message,setMessage]=useState('로그인을 확인하고 있습니다…');
 const [width,setWidth]=useState(1280),[scale,setScale]=useState(1),[previewHeight,setPreviewHeight]=useState(760);
 const [picker,setPicker]=useState(false);
 const imageButton=useRef<HTMLButtonElement>(null);
 const closePicker=()=>{setPicker(false);imageButton.current?.focus();};
 const owner=useRef<string|null>(null),loaded=useRef(false),frame=useRef<HTMLIFrameElement>(null),previewBox=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved),unsaved=dirty||!!file;
 const mayLeave=()=>!unsaved||window.confirm('저장하지 않은 홈페이지 변경 내용을 버릴까요?');
 useEffect(()=>{if(!client)return;let active=true;
  async function load(){try{
   const user=await client!.auth.getUser();if(user.error||!user.data.user)throw new Error('login');
   const member=await client!.from('church_editors').select('user_id').eq('user_id',user.data.user.id).maybeSingle();if(member.error||!member.data)throw new Error('login');
   const [settings,assets]=await Promise.all([client!.from('homepage_content').select('*').maybeSingle(),client!.from('bulletin_images').select('*').order('created_at',{ascending:false}).limit(100)]);if(settings.error||assets.error)throw settings.error??assets.error;
   if(!active)return;if(!loaded.current||owner.current!==user.data.user.id){const current=editableContent(settings.data);setDraft(current);setSaved(current);setFile(null);}
   owner.current=user.data.user.id;loaded.current=true;setImages(assets.data);setAllowed(true);setMessage('');
  }catch(e){if(active){setAllowed(false);setMessage((e as {code?:string}).code==='PGRST205'?'홈페이지 설정 DB 적용이 필요합니다. 기존 기능은 그대로 사용할 수 있습니다.':'관리자 로그인이 필요합니다. 같은 계정으로 다시 로그인하면 현재 탭의 입력을 이어갈 수 있습니다.');}}}
  void load();const {data:{subscription}}=client.auth.onAuthStateChange(event=>{if(!active)return;if(event==='SIGNED_OUT'){setAllowed(false);setImages([]);setMessage('로그인이 종료되었습니다. 같은 계정으로 다시 로그인해 주세요.');}if(event==='SIGNED_IN')setReload(n=>n+1);});return()=>{active=false;subscription.unsubscribe();};
 },[client,reload]);
 useEffect(()=>{if(!unsaved)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',guard);return()=>removeEventListener('beforeunload',guard);},[unsaved]);
 useEffect(()=>{if(!allowed||!['현재 공개 중인 설정을 불러왔습니다.','저장했습니다. 홈페이지에 반영되었습니다.','이미지를 올렸습니다. 미리보기를 확인한 뒤 홈페이지에 반영해 주세요.'].includes(message))return;const timer=setTimeout(()=>setMessage(current=>current===message?'':current),3500);return()=>clearTimeout(timer);},[allowed,message]);
 useEffect(()=>{if(!allowed||!draft.image_asset_id)return;const abort=new AbortController();let objectUrl='';async function load(){setImageSrc('');try{const token=(await client?.auth.getSession())?.data.session?.access_token;const r=await fetch(`/api/images?id=${draft.image_asset_id}`,{signal:abort.signal,cache:'no-store',headers:token?{Authorization:`Bearer ${token}`}:{}});if(!r.ok)throw new Error();const blob=await r.blob();if(abort.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setImageSrc(objectUrl);}catch{if(!abort.signal.aborted)setMessage('선택한 이미지 미리보기를 불러오지 못했습니다. 저장 중인 사진은 바뀌지 않았습니다.');}}void load();return()=>{abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[allowed,client,draft.image_asset_id]);
 useEffect(()=>{if(!allowed||!previewBox.current)return;const box=previewBox.current;const resize=()=>setScale(Math.min(1,box.clientWidth/width));const observer=new ResizeObserver(resize);observer.observe(box);resize();return()=>observer.disconnect();},[allowed,width]);
 function sendPreview(){frame.current?.contentWindow?.postMessage({type:'homepage-preview',content:draft,imageSrc},location.origin);}
 useEffect(()=>{if(allowed)frame.current?.contentWindow?.postMessage({type:'homepage-preview',content:draft,imageSrc},location.origin);},[allowed,draft,imageSrc]);
 useEffect(()=>{if(!allowed)return;const ready=(e:MessageEvent)=>{if(e.origin===location.origin&&e.source===frame.current?.contentWindow&&e.data?.type==='homepage-preview-ready')frame.current?.contentWindow?.postMessage({type:'homepage-preview',content:draft,imageSrc},location.origin);};addEventListener('message',ready);return()=>removeEventListener('message',ready);},[allowed,draft,imageSrc]);
 useEffect(()=>{if(!allowed)return;const resize=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||e.data?.type!=='homepage-preview-height')return;const h=e.data.height;if(typeof h==='number'&&Number.isFinite(h)&&h>=100&&h<=5000)setPreviewHeight(Math.ceil(h));};addEventListener('message',resize);return()=>removeEventListener('message',resize);},[allowed]);
 const change=(values:Partial<HomeContent>)=>{setDraft(current=>({...current,...values}));setMessage('');};
 async function logout(){if(!client||busy||!mayLeave())return;setBusy(true);try{const r=await client.auth.signOut({scope:'local'});if(r.error)throw r.error;}catch{setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function restore(){if(!client||busy||!unsaved||!mayLeave())return;setBusy(true);try{const r=await client.from('homepage_content').select('*').maybeSingle();if(r.error)throw r.error;const content=editableContent(r.data);setDraft(content);setSaved(content);setFile(null);if(fileInput.current)fileInput.current.value='';setMessage('현재 공개 중인 설정을 불러왔습니다.');}catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}}
 async function save(){if(!client||!allowed||busy)return;if(!validHomeContent(draft)){setMessage('제목·문구 길이와 이미지 선택·설명을 확인해 주세요.');return;}
  if(file){setMessage('선택한 파일을 먼저 올리거나 선택을 취소해 주세요.');return;}
  if(!window.confirm('현재 문구와 이미지를 홈페이지에 반영할까요? 저장한 내용은 공개됩니다.'))return;
  setBusy(true);setMessage('');try{const r=await client.rpc('save_homepage_content',{p_revision:draft.revision,p_content:{...draft}});if(r.error)throw r.error;const content=editableContent(r.data);setDraft(content);setSaved(content);setMessage('저장했습니다. 홈페이지에 반영되었습니다.');}catch(e){const code=(e as {code?:string;message?:string});setMessage(code.code==='23505'?'다른 곳에서 홈페이지 설정이 먼저 저장되었습니다. 입력을 보관한 뒤 현재 설정을 다시 불러와 주세요.':code.message==='IMAGE_RESOLUTION_REQUIRED'?'사진은 600×400px 이상, 일러스트는 256×256px 이상을 선택해 주세요.':errorMessage(e));}finally{setBusy(false);}
 }
 async function upload(next:File|null=file){if(!client||!allowed||!next||busy)return;setFile(next);if(next.size>4*1024*1024){setMessage('4MB 이하의 정지된 JPEG·PNG·WebP 파일을 선택해 주세요.');return;}
  const imageAlt='교회 홈페이지 대표 이미지';
  setBusy(true);setMessage('');try{const token=(await client.auth.getSession()).data.session?.access_token;if(!token)throw new Error('login');const r=await fetch('/api/images',{method:'POST',headers:{Authorization:`Bearer ${token}`,'x-image-title':encodeURIComponent('홈페이지 표지'),'x-image-alt':encodeURIComponent(imageAlt)},body:next});const data=await r.json();if(!r.ok)throw new Error(data.error);
   setImages(current=>[data,...current]);setDraft(current=>({...current,image_asset_id:data.id,image_alt:imageAlt,image_mode:current.image_mode==='art'?'photo':current.image_mode}));setFile(null);if(fileInput.current)fileInput.current.value='';setMessage('이미지를 올렸습니다. 미리보기를 확인한 뒤 홈페이지에 반영해 주세요.');
  }catch(e){setMessage(e instanceof Error?e.message:'이미지를 올리지 못했습니다. 기존 선택은 유지됩니다.');}finally{setBusy(false);}
 }
 const copyDirty=(Object.keys(labels) as (keyof typeof labels)[]).some(key=>draft[key]!==saved[key]);
 const textInput=(key:keyof typeof labels,placeholder?:string)=><div className={ui.countedInput}><input id={`home-${key}`} aria-label={labels[key]} placeholder={placeholder} value={draft[key]} maxLength={homeTextLimits[key]} onChange={e=>change({[key]:e.target.value.replace(/[\r\n]/g,'')})}/><span aria-hidden="true">{draft[key].length}/{homeTextLimits[key]}</span></div>;
 const intro=<header className={ui.intro}><div><span className={styles.eyebrow}>HOMEPAGE CONTENT</span><h1 id="home-management-title">홈페이지 관리</h1><p>문구와 사진을 바꾸고 미리보기로 확인한 뒤 반영해 주세요.</p></div></header>;
 return <AdminShell active="home" intro={intro} authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} sections={[{id:'home-preview',label:'미리보기'},{id:'home-copy',label:'첫 화면 문구'},{id:'home-image',label:'사진·일러스트'}]}><main id="admin-content" aria-labelledby="home-management-title" tabIndex={-1} className={`${styles.page} ${ui.editor}`}>
  {!allowed?<ReauthPanel message={message} hasDraft={unsaved} onRetry={()=>{setMessage("로그인 상태를 확인하고 있습니다…");setReload(n=>n+1);}}/>:<>
   <section id="home-preview" tabIndex={-1} className={ui.previewSection} aria-label="미리보기"><div className={ui.sectionHeading}><h2>미리보기</h2><div className={ui.deviceSwitch}>{[[1280,'PC'],[390,'모바일']].map(([value,label])=><button key={value} aria-pressed={width===value} onClick={()=>setWidth(Number(value))}>{label}</button>)}</div></div><div ref={previewBox} className={`${styles.homePreviewBox} ${ui.previewBox}`} style={{height:previewHeight*scale}}><iframe ref={frame} title="홈페이지 첫 화면 미리보기" src="/admin/home/preview" onLoad={sendPreview} style={{width,height:previewHeight,left:'50%',marginLeft:-width*scale/2,transform:`scale(${scale})`}}/></div>
    <div className={ui.publishActions}><button disabled={busy||!dirty||!!file} className={styles.primary} onClick={()=>void save()}>이렇게 반영하기</button><button disabled={busy||!unsaved} onClick={()=>void restore()}>이전 설정 불러오기</button></div>
    {message?<p role="status" className={ui.feedback}>{message}</p>:null}
   </section>
   <fieldset disabled={busy} className={styles.fields}><section id="home-copy" tabIndex={-1} className={ui.section} aria-label="첫 화면 문구"><div className={ui.sectionHeading}><h2>첫 화면 문구</h2><span className={ui.editStatus}>{copyDirty?'수정 중':'최신 버전'}</span></div>
    <div className={ui.textRow} role="group" aria-labelledby="title-label"><div className={ui.rowLabel}><label id="title-label" htmlFor="home-title_line1">제목</label></div><div className={ui.inputPair}>{textInput('title_line1','첫째 줄')}{textInput('title_line2','둘째 줄')}</div></div>
    <div className={ui.textRow} role="group" aria-labelledby="description-label"><div className={ui.rowLabel}><label id="description-label" htmlFor="home-description_line1">설명</label></div><div className={ui.inputPair}>{textInput('description_line1','첫째 줄')}{textInput('description_line2','둘째 줄')}</div></div>
    <div className={ui.textRow}><div className={ui.rowLabel}><label htmlFor="home-link_label">교회 소개 버튼 문구</label></div>{textInput('link_label')}</div>
    <div className={ui.textRow}><div className={ui.rowLabel}><label htmlFor="home-footnote">하단 환영 문구</label></div>{textInput('footnote')}</div>
   </section>
   <section id="home-image" tabIndex={-1} className={ui.section} aria-label="사진·일러스트"><div className={ui.sectionHeading}><h2>사진·일러스트</h2></div><div className={ui.imageRow}><div className={ui.thumbnail}>{draft.image_mode!=='art'&&imageSrc?<>
    {/* Authenticated local blob, never a public URL for unsaved assets. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={imageSrc} alt={draft.image_alt} style={{objectFit:draft.image_mode==='illustration'?'contain':'cover',objectPosition:`${draft.focus_x}% ${draft.focus_y}%`}}/></>:<div className={ui.artThumbnail} aria-label={draft.image_mode==='art'?'기본 교회 일러스트':'선택한 이미지 준비 중'} role="img"><span>{draft.image_mode==='art'?'✝':'…'}</span></div>}</div><div className={ui.imageControls}><button ref={imageButton} aria-haspopup="dialog" onClick={()=>setPicker(true)}>새 이미지 선택</button><input hidden aria-label="새 이미지 파일" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const next=e.target.files?.[0];if(next)void upload(next);}}/>
    <input aria-label="이미지 설명" value={draft.image_alt} maxLength={200} placeholder="이미지 설명" onChange={e=>change({image_alt:e.target.value})}/>
    {draft.image_mode!=='art'?<div role="radiogroup" aria-label="이미지 표시 방식" className={ui.fitOptions}><label><input type="radio" name="home-image-fit" checked={draft.image_mode==='photo'} onChange={()=>change({image_mode:'photo'})}/>틀에 채우기</label><label><input type="radio" name="home-image-fit" checked={draft.image_mode==='illustration'} onChange={()=>change({image_mode:'illustration'})}/>전체 보이기</label></div>:null}
    {file?<div className={ui.uploadRetry}><span>{file.name}</span><button onClick={()=>void upload()}>다시 올리기</button><button onClick={()=>{setFile(null);if(fileInput.current)fileInput.current.value='';setMessage('');}}>파일 선택 취소</button></div>:null}</div></div>
    {draft.image_mode!=='art'?<details className={ui.imageDetails}><summary>크기·위치 조정</summary><div className={ui.detailsContent}><label>이미지 틀 비율<select value={draft.image_ratio} onChange={e=>change({image_ratio:e.target.value as HomeContent['image_ratio']})}><option value="portrait">세로 4:5</option><option value="square">정사각형 1:1</option><option value="landscape">가로 4:3</option></select></label>{draft.image_mode==='photo'?<><label>가로 초점 · {draft.focus_x}%<input type="range" min="0" max="100" value={draft.focus_x} onChange={e=>change({focus_x:Number(e.target.value)})}/></label><label>세로 초점 · {draft.focus_y}%<input type="range" min="0" max="100" value={draft.focus_y} onChange={e=>change({focus_y:Number(e.target.value)})}/></label></>:null}</div></details>:null}
   </section></fieldset>
   {picker?<ImagePicker images={images} onClose={closePicker} onDefault={()=>{change({image_mode:'art',image_asset_id:null,image_alt:''});setFile(null);if(fileInput.current)fileInput.current.value='';closePicker();}} onDevice={()=>{closePicker();fileInput.current?.click();}} onSelect={image=>{change({image_asset_id:image.id,image_alt:image.alt.slice(0,200),image_mode:draft.image_mode==='art'?'photo':draft.image_mode});setFile(null);if(fileInput.current)fileInput.current.value='';closePicker();}}/>:null}
  </>}
 </main></AdminShell>;
}
