"use client";
import { useState } from "react";

export default function PublicPdfDownload({ date }: { date: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/bulletins/pdf?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `bulletin-${date}.pdf`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("공개용 PDF를 내려받았습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "PDF를 내려받지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <div><button disabled={busy} onClick={download}>{busy ? "PDF 만드는 중…" : "공개용 PDF 다운로드"}</button><p role="status">{message}</p></div>;
}
