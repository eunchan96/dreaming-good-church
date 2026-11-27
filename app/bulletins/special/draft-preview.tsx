"use client";
import { useEffect, useState } from "react";
import { makeBrowserClient } from "@/lib/bulletin-store";
import { parseProgramContent, type SpecialProgramContent } from "@/lib/special-programs";
import SpecialReader from "./special-reader";
import styles from "./special.module.css";

type Loaded = { slug: string; title: string; content: SpecialProgramContent; pdfUrl: string | null };

/** 아직 공개 전인 순서지를 편집자(로그인한 상태)에게만 보여 준다. 편집자가 아니거나 없는 순서지면 '찾을 수 없음'. */
export default function DraftPreview({ slug }: { slug: string }) {
  const [state, setState] = useState<"loading" | "missing" | Loaded>("loading");
  useEffect(() => {
    let url: string | null = null, cancelled = false;
    (async () => {
      try {
        const client = makeBrowserClient();
        const session = client ? (await client.auth.getSession()).data.session : null;
        if (!client || !session) { if (!cancelled) setState("missing"); return; }
        const { data, error } = await client.from("special_programs").select("slug,title,content,pdf_path").eq("slug", slug).maybeSingle();
        const content = !error && data ? parseProgramContent(data.content) : null;
        if (!data || !content) { if (!cancelled) setState("missing"); return; }
        if (data.pdf_path) { const file = await client.storage.from("special-programs").download(data.pdf_path); if (file.data) url = URL.createObjectURL(file.data); }
        if (!cancelled) setState({ slug: data.slug, title: data.title, content, pdfUrl: url });
      } catch { if (!cancelled) setState("missing"); }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [slug]);
  if (state === "loading") return <p role="status" className={styles.draftNote}>불러오는 중…</p>;
  if (state === "missing") return <p role="status" className={styles.draftNote}>순서지를 찾을 수 없습니다. 공개되지 않았거나 주소가 맞지 않아요.</p>;
  return <>
    <p role="status" className={styles.draftNote}>공개 전 미리보기입니다. 로그인한 편집자에게만 보여요.</p>
    <SpecialReader slug={state.slug} title={state.title} content={state.content} hasPdf={!!state.pdfUrl} pdfUrl={state.pdfUrl ?? undefined} />
  </>;
}
