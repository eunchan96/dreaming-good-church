"use client";
import { useEffect, useState } from "react";
export default function OfflineControls() {
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      void Promise.resolve().then(() => { if (active) setMessage(!window.isSecureContext ? '오프라인 저장은 HTTPS 주소에서 사용할 수 있습니다. 현재 주소에서는 온라인으로만 볼 수 있습니다.' : '이 브라우저에서는 오프라인 저장을 사용할 수 없습니다.'); });
      return () => { active = false; };
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(() => navigator.serviceWorker.ready).then(() => { if (active) setReady(true); }).catch(() => { if (active) setMessage('이 브라우저에서는 오프라인 저장을 사용할 수 없습니다.'); });
    const offline = () => setMessage('오프라인입니다. 저장한 내용 보기에서 저장 시점의 내용을 확인할 수 있습니다.');
    window.addEventListener('offline', offline); if (!navigator.onLine) offline();
    return () => { active = false; window.removeEventListener('offline', offline); };
  }, []);
  async function request(action: 'SAVE_PUBLIC' | 'CLEAR') {
    if (busy) return; setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      const result = await new Promise<{ ok: boolean; savedAt?: number }>((resolve, reject) => {
        const timeout = window.setTimeout(() => { channel.port1.close(); reject(new Error()); }, 20000);
        channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
        registration.active!.postMessage(action, [channel.port2]);
      });
      setMessage(result.ok ? action === 'CLEAR' ? '저장 내용을 지웠습니다.' : `공개 주보와 안내를 저장했습니다. 저장 시점: ${new Date(result.savedAt!).toLocaleString('ko-KR')}` : '저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
    } catch { setMessage('처리하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.'); } finally { setBusy(false); }
  }
  return <section aria-label="오프라인 저장"><h2>오프라인 저장</h2><p>최신 공개 주보의 글·표와 교회 안내를 이 기기에 24시간 저장합니다. 저장 뒤 공개 취소된 내용이 남을 수 있습니다. 공용 기기에서는 사용 후 지워 주세요. 이미지·공지·일정·관리자 내용은 저장하지 않습니다.</p><button disabled={!ready || busy} onClick={() => void request('SAVE_PUBLIC')}>공개 주보·안내 저장</button> <button disabled={!ready || busy} onClick={() => void request('CLEAR')}>오프라인 저장 지우기</button> <a href="/offline.html">저장한 내용 보기</a><p role="status">{message}</p></section>;
}
