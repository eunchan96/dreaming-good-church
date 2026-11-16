"use client";
import { useState } from "react";
import { BulletinImageView } from "@/app/bulletin-image";
import type { BulletinItem } from "@/lib/bulletins";
import AdminIcon from "../admin-icons";
import ImageChooser from "../image-chooser";
import css from "./image-picker.module.css";
import btn from "../buttons.module.css";

/** 표지 images: attached cards (thumbnail · 설명 · 빼기) and one 이미지 추가 button that uploads or picks from the library. */
export function CoverImages({ items, disabled, onAdd, onRemove }: { items: BulletinItem[]; disabled: boolean; onAdd: (items: BulletinItem[]) => void; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className={css.cover}>
    {items.length ? <ul className={css.cards}>{items.map(item => { const content = item.content ?? {}; return <li key={item.id} id={`edit-item-${item.id}`} tabIndex={-1} aria-label={`표지 이미지 ${item.title}`}>
      <span className={css.thumb}>{content.assetId ? <BulletinImageView key={content.assetId} id={content.assetId} alt={content.alt ?? ""} editor fallback={<AdminIcon name="image" size={22} />} /> : null}</span>
      <span className={css.name}>{item.title}</span>
      <button type="button" className={css.remove} disabled={disabled} aria-label={`${item.title} 이미지 빼기`} title="주보에서 빼기 (보관함 원본은 유지)" onClick={() => onRemove(item.id)}><AdminIcon name="remove" size={15} /></button>
    </li>; })}</ul> : null}
    <button type="button" className={`${btn.add} ${css.add}`} disabled={disabled} onClick={() => setOpen(true)}><AdminIcon name="image" size={15} />이미지 추가</button>
    {open ? <ImageChooser attached={items.map(item => item.content?.assetId ?? "")} onClose={() => setOpen(false)} onPick={images => onAdd(images.map(image => ({ id: crypto.randomUUID(), title: image.title, body: "", kind: "image", content: { assetId: image.id, alt: image.alt }, webVisible: true, reviewOnCopy: false, needsReview: false })))} /> : null}
  </div>;
}
