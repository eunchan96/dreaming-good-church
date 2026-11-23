"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import SiteIcon from "./site-icon";
import css from "./install.module.css";
import { getInstallPrompt, clearInstallPrompt, subscribeInstallPrompt, serverInstallPrompt } from '@/lib/install-prompt';

export default function InstallGuide() {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, serverInstallPrompt);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const complete = () => { setInstalled(true); clearInstallPrompt(); setMessage("설치했습니다. 홈 화면이나 앱 목록에서 열 수 있습니다."); };
    update(); media.addEventListener("change", update);
    window.addEventListener("appinstalled", complete);
    return () => { media.removeEventListener("change", update); window.removeEventListener("appinstalled", complete); };
  }, []);
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "설치 요청을 확인했습니다. 완료 후 홈 화면이나 앱 목록에서 열어 주세요." : "설치를 취소했습니다. 브라우저 메뉴에서 나중에 설치할 수 있습니다.");
    } catch { setMessage("설치 창을 열지 못했습니다. 아래 브라우저별 안내를 이용해 주세요."); }
    finally { clearInstallPrompt(); setBusy(false); }
  }
  return <div className={css.page}>
    <section className={css.block} aria-label="홈 화면에 추가 · 설치 안내">
      <p className={css.label}>INSTALL</p>
      <h2>홈 화면에 추가 · 설치 안내</h2>
      {installed ? <p className={css.state}>앱 화면으로 사용 중입니다.</p> : <>
        {prompt ? <button type="button" className={css.action} disabled={busy} onClick={() => void install()}>{busy ? "설치 확인 중…" : "좋은교회 앱 설치"}<SiteIcon size={16} /></button> : null}
        <ul className={css.devices}>
          <li><small>iPhone · iPad</small><strong>아이폰·아이패드</strong><p>Safari의 공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요.</p></li>
          <li><small>ANDROID</small><strong>안드로이드</strong><p>Chrome 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.</p></li>
          <li><small>PC</small><strong>PC</strong><p>Chrome·Edge 주소창의 설치 아이콘이나 브라우저 메뉴를 확인하세요.</p></li>
        </ul>
        <div className={css.notes}>
          <p>설치 메뉴는 브라우저와 기기에 따라 다릅니다. 최신 콘텐츠를 보려면 인터넷 연결이 필요합니다.</p>
          <p>홈 화면 설치는 HTTPS 보안 연결에서 이용할 수 있습니다.</p>
        </div>
      </>}
      <p role="status" className={css.status}>{message}</p>
    </section>
  </div>;
}
