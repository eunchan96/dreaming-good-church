'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {makeBrowserClient,errorMessage} from '@/lib/bulletin-store';
import {defaultHomeContent,homeTextLimits,validHomeContent,type HomeContent} from '@/lib/home-content';
import type {BulletinImage} from '@/lib/church';
import AdminShell from '../admin-shell';
import ReauthPanel from '../reauth-panel';
import InfoTip from '../info-tip';
import styles from '../bulletins/workspace.module.css';
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
 const [width,setWidth]=useState(390),[scale,setScale]=useState(1);
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
 useEffect(()=>{if(!allowed||!draft.image_asset_id)return;const abort=new AbortController();let objectUrl='';async function load(){setImageSrc('');try{const token=(await client?.auth.getSession())?.data.session?.access_token;const r=await fetch(`/api/images?id=${draft.image_asset_id}`,{signal:abort.signal,cache:'no-store',headers:token?{Authorization:`Bearer ${token}`}:{}});if(!r.ok)throw new Error();const blob=await r.blob();if(abort.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setImageSrc(objectUrl);}catch{if(!abort.signal.aborted)setMessage('선택한 이미지 미리보기를 불러오지 못했습니다. 저장 중인 사진은 바뀌지 않았습니다.');}}void load();return()=>{abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[allowed,client,draft.image_asset_id]);
 useEffect(()=>{if(!allowed||!previewBox.current)return;const box=previewBox.current;const resize=()=>setScale(Math.min(1,box.clientWidth/width));const observer=new ResizeObserver(resize);observer.observe(box);resize();return()=>observer.disconnect();},[allowed,width]);
 function sendPreview(){frame.current?.contentWindow?.postMessage({type:'homepage-preview',content:draft,imageSrc},location.origin);}
 useEffect(()=>{if(allowed)frame.current?.contentWindow?.postMessage({type:'homepage-preview',content:draft,imageSrc},location.origin);},[allowed,draft,imageSrc]);
 useEffect(()=>{if(!allowed)return;const ready=(e:MessageEvent)=>{if(e.origin===location.origin&&e.source===frame.current?.contentWindow&&e.data?.type==='homepage-preview-ready')frame.current?.contentWindow?.postMessage({type:'homepage-preview',content:draft,imageSrc},location.origin);};addEventListener('message',ready);return()=>removeEventListener('message',ready);},[allowed,draft,imageSrc]);
 const change=(values:Partial<HomeContent>)=>{setDraft(current=>({...current,...values}));setMessage('');};
 async function logout(){if(!client||busy||!mayLeave())return;setBusy(true);try{const r=await client.auth.signOut({scope:'local'});if(r.error)throw r.error;}catch{setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function restore(){if(!client||busy||!mayLeave())return;setBusy(true);try{const r=await client.from('homepage_content').select('*').maybeSingle();if(r.error)throw r.error;const content=editableContent(r.data);setDraft(content);setSaved(content);setFile(null);if(fileInput.current)fileInput.current.value='';setMessage('현재 공개 중인 설정을 불러왔습니다.');}catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}}
 async function save(){if(!client||!allowed||busy)return;if(!validHomeContent(draft)){setMessage('제목·문구 길이와 이미지 선택·설명을 확인해 주세요.');return;}
  if(file){setMessage('선택한 파일을 먼저 올리거나 선택을 취소해 주세요.');return;}
  if(!window.confirm('현재 문구와 이미지를 홈페이지에 반영할까요? 저장한 내용은 공개됩니다.'))return;
  setBusy(true);setMessage('');try{const r=await client.rpc('save_homepage_content',{p_revision:draft.revision,p_content:{...draft}});if(r.error)throw r.error;const content=editableContent(r.data);setDraft(content);setSaved(content);setMessage('저장했습니다. 홈페이지에 반영되었습니다.');}catch(e){const code=(e as {code?:string;message?:string});setMessage(code.code==='23505'?'다른 곳에서 홈페이지 설정이 먼저 저장되었습니다. 입력을 보관한 뒤 현재 설정을 다시 불러와 주세요.':code.message==='IMAGE_RESOLUTION_REQUIRED'?'사진은 600×400px 이상, 일러스트는 256×256px 이상을 선택해 주세요.':errorMessage(e));}finally{setBusy(false);}
 }
 async function upload(){if(!client||!allowed||!file||busy)return;if(!draft.image_alt.trim()){setMessage('이미지 설명을 먼저 입력해 주세요.');return;}if(file.size>4*1024*1024){setMessage('4MB 이하의 정지된 JPEG·PNG·WebP 파일을 선택해 주세요.');return;}
  setBusy(true);setMessage('');try{const token=(await client.auth.getSession()).data.session?.access_token;if(!token)throw new Error('login');const r=await fetch('/api/images',{method:'POST',headers:{Authorization:`Bearer ${token}`,'x-image-title':encodeURIComponent('홈페이지 표지'),'x-image-alt':encodeURIComponent(draft.image_alt)},body:file});const data=await r.json();if(!r.ok)throw new Error(data.error);
   setImages(current=>[data,...current]);setDraft(current=>({...current,image_asset_id:data.id,image_mode:current.image_mode==='art'?'photo':current.image_mode}));setFile(null);if(fileInput.current)fileInput.current.value='';setMessage('이미지를 올렸습니다. 미리보기를 확인한 뒤 홈페이지에 반영해 주세요.');
  }catch(e){setMessage(e instanceof Error?e.message:'이미지를 올리지 못했습니다. 기존 선택은 유지됩니다.');}finally{setBusy(false);}
 }
 const selected=images.find(image=>image.id===draft.image_asset_id);
 return <AdminShell active="home" authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy} sections={[{id:'home-copy',label:'첫 화면 문구'},{id:'home-image',label:'사진·일러스트'},{id:'home-preview',label:'PC·모바일 미리보기'},{id:'home-save',label:'홈페이지 반영'}]}><main id="admin-content" tabIndex={-1} className={styles.page}>
  <header className={styles.header}><div><span className={styles.eyebrow}>HOMEPAGE CONTENT</span><h1>홈페이지 관리</h1></div><InfoTip label="홈페이지 설정"><p>첫 화면의 문구와 사진을 바꿉니다. 제목은 줄마다 권장8자·최대12자입니다. 실제 글꼴과 너비에 따라 크기를 맞추며 미리보기로 확인해 주세요.</p><p>사진은 잘라 채우기, 일러스트는 전체 보이기를 사용합니다. 누끼 이미지만으로 제한하지 않습니다. 새 파일은 4MB 이하이며 긴 변 2400px로 정규화하고 위치 정보를 제거합니다. 파일 업로드만으로는 공개되지 않습니다.</p><p>인사말·주소·연락처는 교회 정보에서 수정합니다. 저장 시 공개 화면에 반영되므로 사진 게시 동의와 이미지 설명을 확인해 주세요.</p></InfoTip></header>
  {allowed&&message?<p role="status" className={styles.message}>{message}</p>:null}
  {!allowed?<ReauthPanel message={message} hasDraft={unsaved} onRetry={()=>{setMessage("로그인 상태를 확인하고 있습니다…");setReload(n=>n+1);}}/>:<>
   <fieldset disabled={busy} className={styles.fields}><section id="home-copy" tabIndex={-1} className={styles.flatSection}><h2>첫 화면 문구</h2><p className={styles.muted}>{dirty?'수정 중':'현재 공개 설정'} · <Link href="/admin/church" onClick={e=>{if(!mayLeave())e.preventDefault();}}>인사말·교회 정보 관리</Link></p>
   {(Object.keys(labels) as (keyof typeof labels)[]).map(key=><label key={key}>{labels[key]}<span className={styles.fieldStatus}> {draft[key].length}/{homeTextLimits[key]}</span><input aria-label={labels[key]} value={draft[key]} maxLength={homeTextLimits[key]} onChange={e=>change({[key]:e.target.value.replace(/[\r\n]/g,'')})}/></label>)}</section>
   <section id="home-image" tabIndex={-1} className={styles.flatSection}><h2>사진·일러스트</h2><label>표시 방식<select value={draft.image_mode} onChange={e=>change({image_mode:e.target.value as HomeContent['image_mode'],...(e.target.value==='art'?{image_asset_id:null}:{})})}><option value="art">기본 교회 일러스트</option><option value="photo">사진 · 잘라 채우기</option><option value="illustration">일러스트 · 전체 보이기</option></select></label>
    <label>이미지 설명<input value={draft.image_alt} maxLength={200} placeholder="사진에 보이는 내용을 간단히 적어 주세요" onChange={e=>change({image_alt:e.target.value})}/></label><label>보관함에서 선택<select value={draft.image_asset_id??''} onChange={e=>{const image=images.find(row=>row.id===e.target.value);change({image_asset_id:image?.id??null,...(image?{image_alt:image.alt.slice(0,200),image_mode:draft.image_mode==='art'?'photo':draft.image_mode}:{})});}}><option value="">이미지 선택</option>{draft.image_asset_id&&!selected?<option value={draft.image_asset_id}>현재 홈페이지 이미지</option>:null}{images.map(image=><option key={image.id} value={image.id}>{image.title} · {image.width}×{image.height}</option>)}</select></label>
    {selected?<p className={styles.muted}>{selected.width}×{selected.height}px · {Math.round(selected.bytes/1024)}KB{draft.image_mode==='photo'&&(selected.width<600||selected.height<400)?' · 사진은600×400px 이상 필요합니다.':''}</p>:null}
    <label>새 이미지 파일<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><div className={styles.actions}><button disabled={!file} onClick={()=>void upload()}>이미지 올리기</button>{file?<button onClick={()=>{setFile(null);if(fileInput.current)fileInput.current.value='';}}>파일 선택 취소</button>:null}</div>
    <label>이미지 틀 비율<select disabled={draft.image_mode==='art'} value={draft.image_ratio} onChange={e=>change({image_ratio:e.target.value as HomeContent['image_ratio']})}><option value="portrait">세로4:5</option><option value="square">정사각형1:1</option><option value="landscape">가로4:3</option></select></label>
    <label>가로 초점 · {draft.focus_x}%<input type="range" min="0" max="100" disabled={draft.image_mode!=='photo'} value={draft.focus_x} onChange={e=>change({focus_x:Number(e.target.value)})}/></label><label>세로 초점 · {draft.focus_y}%<input type="range" min="0" max="100" disabled={draft.image_mode!=='photo'} value={draft.focus_y} onChange={e=>change({focus_y:Number(e.target.value)})}/></label>
   </section></fieldset>
   <section id="home-preview" tabIndex={-1} className={styles.flatSection}><div className={styles.compactTitle}><h2>PC·모바일 미리보기</h2><InfoTip label="미리보기"><p>저장 전 현재 입력을 실제 공개 구성으로 표시합니다. PC는1280px, 모바일은390px 또는320px 화면을 축소해 보여줍니다. 미리보기 안의 링크는 이동하지 않습니다.</p></InfoTip></div><div className={styles.actions}>{[[1280,'PC'],[390,'모바일390'],[320,'모바일320']].map(([value,label])=><button key={value} aria-pressed={width===value} onClick={()=>setWidth(Number(value))}>{label}</button>)}</div><div ref={previewBox} className={styles.homePreviewBox} style={{height:(width===1280?850:844)*scale}}><iframe ref={frame} title="홈페이지 첫 화면 미리보기" src="/admin/home/preview" onLoad={sendPreview} style={{width,height:width===1280?850:844,left:'50%',marginLeft:-width*scale/2,transform:`scale(${scale})`}}/></div></section>
   <section id="home-save" tabIndex={-1} className={styles.flatSection}><h2>홈페이지 반영</h2><div className={styles.actions}><button disabled={busy||!dirty} className={styles.primary} onClick={()=>void save()}>저장하고 홈페이지에 반영</button><button disabled={busy} onClick={()=>void restore()}>현재 공개 설정 다시 불러오기</button></div></section>
  </>}
 </main></AdminShell>;
}
