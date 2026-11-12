"use client";
import { useEffect, useState } from "react";
import styles from "./public-site.module.css";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallGuide() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const complete = () => { setInstalled(true); setPrompt(null); setMessage("설치했습니다. 홈 화면이나 앱 목록에서 열 수 있습니다."); };
    update(); media.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", available); window.addEventListener("appinstalled", complete);
    return () => { media.removeEventListener("change", update); window.removeEventListener("beforeinstallprompt", available); window.removeEventListener("appinstalled", complete); };
  }, []);
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "설치 요청을 확인했습니다. 완료 후 홈 화면이나 앱 목록에서 열어 주세요." : "설치를 취소했습니다. 브라우저 메뉴에서 나중에 설치할 수 있습니다.");
    } catch { setMessage("설치 창을 열지 못했습니다. 아래 브라우저별 안내를 이용해 주세요."); }
    finally { setPrompt(null); setBusy(false); }
  }
  return <details className={styles.install}><summary>홈 화면에 추가 · 설치 안내</summary>
    {installed ? <p>앱 화면으로 사용 중입니다.</p> : <>
      {prompt ? <button disabled={busy} onClick={() => void install()}>{busy ? "설치 확인 중…" : "좋은교회 앱 설치"}</button> : null}
      <p>아이폰·아이패드: Safari의 공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요.</p>
      <p>안드로이드: Chrome 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.</p>
      <p>PC: Chrome·Edge 주소창의 설치 아이콘이나 브라우저 메뉴를 확인하세요.</p>
      <p>설치 메뉴는 브라우저와 기기에 따라 다릅니다. 설치 후에도 콘텐츠를 보려면 인터넷 연결이 필요합니다.</p>
    </>}
    <p role="status">{message}</p>
  </details>;
}
