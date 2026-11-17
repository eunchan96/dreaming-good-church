'use client';
import { useState } from 'react';
import { BulletinImageView } from '@/app/bulletin-image';
import AdminIcon from '../admin-icons';
import ImageChooser from '../image-chooser';
import btn from '../buttons.module.css';
import css from './workspace.module.css';

export type PortraitDraft = { image_asset_id: string | null; alt: string; revision: number };

/** 인사말 사진: pick or upload from the library; saved with the 인사말 묶음. */
export default function PortraitField({ value, ready, disabled, onChange }: { value: PortraitDraft; ready: boolean; disabled: boolean; onChange: (next: PortraitDraft) => void }) {
  const [open, setOpen] = useState(false);
  if (!ready) return <p className={css.photoNote}>사진 기능은 DB 업데이트 후 사용할 수 있습니다.</p>;
  return <div className={css.photoField}>
    <span className={css.photoFrame}>{value.image_asset_id ? <BulletinImageView key={value.image_asset_id} id={value.image_asset_id} alt={value.alt} editor fallback={<AdminIcon name="image" size={22} />} /> : <span className={css.photoEmpty} aria-hidden="true"><AdminIcon name="image" size={24} /></span>}</span>
    <div className={css.photoControls}>
      <div className={css.photoButtons}>
        <button type="button" className={`${btn.btn} ${btn.small}`} disabled={disabled} onClick={() => setOpen(true)}><AdminIcon name="image" size={15} />{value.image_asset_id ? '사진 바꾸기' : '사진 넣기'}</button>
        {value.image_asset_id ? <button type="button" className={`${btn.btn} ${btn.ghost} ${btn.small}`} disabled={disabled} onClick={() => onChange({ ...value, image_asset_id: null, alt: '' })}>사진 빼기</button> : null}
      </div>
      {value.image_asset_id ? <label className={css.photoAlt}><span>설명</span><input aria-label="목사님 사진 설명" maxLength={200} placeholder="예: 담임목사 최선주" value={value.alt} disabled={disabled} onChange={e => onChange({ ...value, alt: e.target.value })} /></label> : <p className={css.photoNote}>세로 사진(3:4)이 잘 어울립니다. 저장하면 공개 인사말에 나옵니다.</p>}
    </div>
    {open ? <ImageChooser attached={value.image_asset_id ? [value.image_asset_id] : []} onClose={() => setOpen(false)} onPick={images => { const image = images[0]; if (image) onChange({ ...value, image_asset_id: image.id, alt: value.alt || '담임목사 사진' }); }} /> : null}
  </div>;
}
