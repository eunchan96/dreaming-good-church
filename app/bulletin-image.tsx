"use client";
import { useEffect, useState } from "react";
import { makeBrowserClient } from "@/lib/bulletin-store";
export function BulletinImageView({ id, alt, editor = false }: { id: string; alt: string; editor?: boolean }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = "";
    async function load() {
      try {
        const token = editor ? (await makeBrowserClient()?.auth.getSession())?.data.session?.access_token : null;
        const response = await fetch(`/api/images?id=${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!response.ok) return;
        const blob = await response.blob(); if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setSrc(objectUrl);
      } catch { /* Hidden, revoked or unavailable images are not rendered. */ }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, editor]);
  // A blob URL keeps authenticated images out of Next's shared image optimization cache.
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} style={{ maxWidth: "100%", height: "auto" }} /> : <p>이미지를 불러올 수 없거나 불러오는 중입니다.</p>;
}
