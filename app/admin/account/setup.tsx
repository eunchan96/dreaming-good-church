"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { makeBrowserClient } from "@/lib/bulletin-store";
import styles from "../bulletins/workspace.module.css";

export default function AccountSetup() {
  const router = useRouter();
  const [client] = useState(makeBrowserClient);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function accept() {
    if (!client) return;
    setBusy(true); setMessage("");
    try {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get("token_hash");
      window.history.replaceState(null, "", window.location.pathname);
      if (!token) { setMessage("초대 링크가 필요합니다. 전달받은 링크를 다시 열어 주세요."); return; }
      const result = await client.auth.verifyOtp({ token_hash: token, type: "invite" });
      if (result.error || !result.data.user) { setMessage("초대 링크가 만료되었거나 이미 사용되었습니다. 새 초대 링크를 요청해 주세요."); return; }
      const member = await client.from("church_editors").select("user_id").eq("user_id", result.data.user.id).maybeSingle();
      if (member.error || !member.data) { await client.auth.signOut(); setMessage("편집 권한이 등록되지 않았습니다. 관리자에게 문의해 주세요."); return; }
      setReady(true);
    } catch { setMessage("연결을 확인하고 초대 링크를 다시 열어 주세요."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!client) return;
    if (password.length < 12 || password !== confirmation) { setMessage("비밀번호를 12자 이상 입력하고 두 입력이 같은지 확인해 주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await client.auth.updateUser({ password });
      if (result.error) { setMessage("비밀번호를 저장하지 못했습니다. 다시 시도해 주세요."); return; }
      router.replace("/admin/bulletins");
    } catch { setMessage("연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}><section className={`${styles.card} ${styles.login}`}>
    <h1>관리자 계정 시작하기</h1><p>초대를 확인한 뒤 사용할 비밀번호를 직접 정해 주세요.</p>
    <p role="status" aria-live="polite">{message}</p>
    {!client ? <p>서비스 연결 설정이 필요합니다.</p> : !ready ? <button disabled={busy} onClick={accept}>{busy ? "확인 중…" : "초대 확인"}</button> :
      <form action={save}><label>새 비밀번호<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={busy} /></label><label>비밀번호 확인<input name="confirm" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required disabled={busy} /></label><button disabled={busy}>{busy ? "저장 중…" : "비밀번호 설정하고 시작"}</button></form>}
  </section></main>;
}
