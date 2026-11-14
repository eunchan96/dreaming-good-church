"use client";
import ui from '../management.module.css';
import { useEffect, useState } from "react";
import { makeBrowserClient } from "@/lib/bulletin-store";
import type { BulletinImage } from "@/lib/church";
import type { BulletinItem } from "@/lib/bulletins";
export function ImagePicker({ disabled, onAdd }: { disabled: boolean; onAdd: (item: BulletinItem) => void }) {
  const [images, setImages] = useState<BulletinImage[]>([]), [id, setId] = useState(""), [message, setMessage] = useState("");
  async function load() { const result = await makeBrowserClient()?.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(100); if (!result || result.error) { setMessage("이미지 목록을 불러오지 못했습니다."); return; } setImages(result.data); setMessage(""); }
  useEffect(() => {
    let active = true;
    const client = makeBrowserClient();
    if (client) void client.from("bulletin_images").select("*").order("created_at", { ascending: false }).limit(100).then(result => {
      if (active) { if (result.error) setMessage("이미지 목록을 불러오지 못했습니다."); else setImages(result.data); }
    });
    return () => { active = false; };
  }, []);
  return <section className={ui.formRows}><p><a href="/admin/church" target="_blank" rel="noreferrer">새 탭에서 이미지 업로드·관리</a></p><label>주보에 넣을 이미지<select disabled={disabled} value={id} onChange={e => setId(e.target.value)}><option value="">이미지 선택</option>{images.map(image => <option key={image.id} value={image.id}>{image.title}</option>)}</select></label><button disabled={disabled} onClick={load}>사용할 이미지 새로고침</button><button disabled={disabled || !images.some(image => image.id === id)} onClick={() => { const image = images.find(row => row.id === id); if (image) onAdd({ id: crypto.randomUUID(), title: image.title, body: "", kind: "image", content: { assetId: image.id, alt: image.alt }, webVisible: true, reviewOnCopy: true, needsReview: false }); }}>선택한 이미지 넣기</button><p aria-live="polite">{message}</p></section>;
}
