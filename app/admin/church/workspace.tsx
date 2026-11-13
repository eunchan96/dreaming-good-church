"use client";
import { useEffect, useRef, useState } from "react";
import { makeBrowserClient, errorMessage } from "@/lib/bulletin-store";
import { churchLabels, type ChurchField, type BulletinImage } from "@/lib/church";
import { BulletinImageView } from "@/app/bulletin-image";
import styles from "../bulletins/workspace.module.css";
import AdminShell from '../admin-shell';
const publicPages: Record<string,string> = { introduction:'/church',name:'/church',worship:'/church/worship-times',address:'/church/directions',directions:'/church/directions',phone:'/church/directions' };

export default function ChurchWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [allowed, setAllowed] = useState(false), [reload, setReload] = useState(0);
  const [fields, setFields] = useState<ChurchField[]>([]), [images, setImages] = useState<BulletinImage[]>([]);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("로그인을 확인하고 있습니다…");
  const [title, setTitle] = useState(""), [alt, setAlt] = useState(""), [file, setFile] = useState<File | null>(null);
  const owner = useRef<string | null>(null), loaded = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!client) return;
    let active = true;
    async function load() {
      try {
        const user = await client!.auth.getUser(); if (user.error || !user.data.user) throw new Error();
        const member = await client!.from("church_editors").select("user_id").eq("user_id", user.data.user.id).maybeSingle(); if (member.error || !member.data) throw new Error();
        const [info, assets] = await Promise.all([client!.from("church_info").select("*").order("key"), client!.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(100)]);
        if (info.error || assets.error) throw new Error();
        if (!active) return;
        if (!loaded.current || owner.current !== user.data.user.id) { setFields(info.data); setDirty(false); setTitle(""); setAlt(""); setFile(null); }
        loaded.current = true; owner.current = user.data.user.id; setImages(assets.data); setAllowed(true); setMessage("");
      } catch { if (active) { setAllowed(false); setMessage("관리자 로그인이 필요합니다. 같은 계정으로 다시 로그인하면 현재 탭의 작성 내용을 이어갈 수 있습니다."); } }
    }
    void load();
    const { data: { subscription } } = client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") { setAllowed(false); setImages([]); setMessage("로그인이 종료되었습니다. 같은 계정으로 다시 로그인하면 작성 내용을 이어갈 수 있습니다."); } if (event === "SIGNED_IN") setReload(n => n + 1); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client, reload]);
  const unsaved = dirty || !!file || !!title || !!alt;
  const mayLeave = () => !unsaved || window.confirm('저장하지 않은 입력을 버릴까요?');
  async function logout() {
    if (!client || busy || !mayLeave()) return;
    setBusy(true);
    try { const { error } = await client.auth.signOut({ scope:'local' }); if (error) throw error; }
    catch { setMessage('로그아웃 요청을 확인하지 못했습니다. 로그인 상태를 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!unsaved) return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [unsaved]);
  async function refreshImages() { const result = await client!.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(100); if (result.error) throw result.error; setImages(result.data); }
  async function save() {
    if (!client || !allowed || busy) return;
    setBusy(true); setMessage("");
    try { const result = await client!.rpc("save_church_info", { p_fields: fields }); if (result.error) throw result.error; setFields(result.data); setDirty(false); setMessage("교회 정보를 저장했습니다."); }
    catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); }
  }
  async function imageRequest(method: "POST" | "DELETE", id?: string) {
    if (!client || !allowed || busy) return;
    if (method === "DELETE" && !window.confirm("사용하지 않는 이미지를 삭제할까요? 주보에서 사용 중인 이미지는 삭제되지 않습니다.")) return;
    if (method === "POST" && (!file || !title.trim() || !alt.trim())) { setMessage("이미지 파일, 제목, 이미지 설명을 입력해 주세요."); return; }
    if (file && file.size > 8 * 1024 * 1024) { setMessage("8MB 이하의 이미지를 선택해 주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const token = (await client!.auth.getSession()).data.session?.access_token;
      if (!token) { setAllowed(false); throw new Error("관리자 로그인이 필요합니다."); }
      const response = await fetch(`/api/images${id ? `?id=${id}` : ""}`, { method, headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "x-image-title": encodeURIComponent(title), "x-image-alt": encodeURIComponent(alt) } : {}) }, ...(method === "POST" ? { body: file } : {}) });
      const data = await response.json(); if (!response.ok) { if (response.status === 401) setAllowed(false); throw new Error(data.error); }
      if (method === "POST") { setFile(null); setTitle(""); setAlt(""); if (fileInput.current) fileInput.current.value = ""; }
      await refreshImages(); setMessage(method === "POST" ? "이미지를 올렸습니다. 주보 편집 화면에서 선택해 넣을 수 있습니다." : "이미지를 삭제했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리하지 못했습니다."); } finally { setBusy(false); }
  }
  return <AdminShell active="church" authenticated={allowed} canLeave={mayLeave} onLogout={allowed?logout:undefined} busy={busy}><main id="admin-content" tabIndex={-1} className={styles.page}><header className={styles.header}><div><span className={styles.eyebrow}>ABOUT OUR CHURCH</span><h1>교회 정보·이미지 관리</h1><p>인사말과 방문 안내를 다듬고, 주보에 사용할 사진을 보관하세요.</p></div><a href="/church" target="_blank" rel="noreferrer">공개 교회 안내</a></header>
    <p role="status" className={styles.message}>{message}</p>{!allowed ? <section><a href="/admin/bulletins" target="_blank" rel="noreferrer">새 탭에서 관리자 로그인</a><button onClick={() => setReload(n => n + 1)}>로그인 다시 확인</button></section> : <>
      <section className={styles.card}><h2>교회 기본 정보</h2><p>{busy ? "처리 중…" : dirty ? "저장 전 변경 있음" : "저장됨"}</p><p>저장하면 공개로 선택한 항목이 교회 안내에 반영됩니다. 기존 주보는 바뀌지 않습니다.</p><p>‘교회 소개’에는 목사님 인사말을 작성할 수 있습니다. 공개 인사말 화면에 줄바꿈을 유지해 표시합니다. ‘오시는 길’에는 역·정류장과 도보 안내를 적어 주세요.</p><fieldset disabled={busy} className={styles.fields}>
        {fields.map(field => <div key={field.key} className={styles.fieldPanel}><div className={styles.fieldHeading}><label htmlFor={`church-${field.key}`}>{churchLabels[field.key]}</label><a href={publicPages[field.key] || '/church'} target="_blank" rel="noreferrer">공개 화면 확인</a></div><textarea id={`church-${field.key}`} rows={field.key==='introduction'?7:field.key==='directions'||field.key==='worship'?4:2} maxLength={10000} value={field.body} onChange={e => { setFields(current => current.map(row => row.key === field.key ? { ...row, body: e.target.value } : row)); setDirty(true); }} /><label className={styles.check}><input type="checkbox" checked={field.web_visible} onChange={e => { setFields(current => current.map(row => row.key === field.key ? { ...row, web_visible: e.target.checked } : row)); setDirty(true); }} />{churchLabels[field.key]} 웹 공개</label></div>)}
        <div className={`${styles.actions} ${styles.formActions}`}><button onClick={save}>교회 정보 저장</button><button onClick={() => { if (!dirty || window.confirm("수정 중인 내용을 버리고 다시 불러올까요?")) { loaded.current = false; setReload(n => n + 1); } }}>저장된 정보 다시 불러오기</button></div>
      </fieldset></section>
      <section className={styles.card}><h2>주보 이미지 보관함</h2><p>JPEG·PNG·WebP, 최대 8MB. 긴 변 2400px 이하로 조정하고 위치 정보 등 부가정보를 제거합니다. 이미지는 주보에 넣고 게시해야 공개됩니다.</p>
        <fieldset disabled={busy} className={styles.fields}><label>이미지 제목<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label><label>이미지 설명 (대체텍스트)<input maxLength={500} value={alt} onChange={e => setAlt(e.target.value)} /></label><label>이미지 파일<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><p>{file ? `선택한 파일: ${file.name}` : "선택한 이미지가 없습니다."}</p><button onClick={() => imageRequest("POST")}>이미지 올리기</button><button onClick={() => refreshImages().catch(() => setMessage("이미지 목록을 불러오지 못했습니다."))}>이미지 목록 새로고침</button></fieldset>
        <p>최근 100개. 이미지 교체는 새 파일 업로드로 처리해 과거 주보를 보존합니다.</p>{images.map(image => <article key={image.id}><h3>{image.title}</h3><BulletinImageView id={image.id} alt={image.alt} editor /><p>{image.width} × {image.height} · {Math.round(image.bytes / 1024)}KB</p><button disabled={busy} onClick={() => imageRequest("DELETE", image.id)}>{image.title} 이미지 삭제</button></article>)}
      </section></>}
  </main></AdminShell>;
}
