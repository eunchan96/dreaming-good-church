"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { makeBrowserClient } from "@/lib/bulletin-store";
import { parseAccountHash } from "@/lib/account-links.mjs";
import styles from "../bulletins/workspace.module.css";

export default function AccountSetup() {
  const router = useRouter();
  const [client] = useState(makeBrowserClient);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const acceptedUser=useRef<string|null>(null);

  useEffect(()=>{
    if(!client) return;
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
      if(acceptedUser.current && session?.user.id!==acceptedUser.current) {
        acceptedUser.current=null; setReady(false); setPassword(''); setConfirmation('');
        setMessage('로그인 계정이 바뀌었거나 세션이 만료되었습니다. 계정 링크를 다시 확인해 주세요.');
      }
    });
    return ()=>subscription.unsubscribe();
  },[client]);

  async function accept() {
    if (!client) return;
    setBusy(true); setMessage("");
    try {
      const hash=window.location.hash;
      window.history.replaceState(null, "", window.location.pathname);
      let parsed;
      try {parsed=parseAccountHash(hash);} catch {setMessage('올바른 계정 링크가 필요합니다. 전달받은 링크를 다시 열어 주세요.');return;}
      const result = await client.auth.verifyOtp({ token_hash: parsed.token, type: parsed.type });
      if (result.error || !result.data.user) { setMessage("계정 링크가 만료되었거나 이미 사용되었습니다. 새 계정 링크를 요청해 주세요."); return; }
      const member = await client.from("church_editors").select("user_id").eq("user_id", result.data.user.id).maybeSingle();
      if (member.error || !member.data) { await client.auth.signOut({scope:'local'}); setMessage("편집 권한이 등록되지 않았습니다. 관리자에게 문의해 주세요."); return; }
      acceptedUser.current=result.data.user.id;
      setReady(true);
    } catch { setMessage("연결을 확인하고 계정 링크를 다시 열어 주세요."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!client) return;
    if (password.length < 12 || password !== confirmation) { setMessage("비밀번호를 12자 이상 입력하고 두 입력이 같은지 확인해 주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const current=await client.auth.getUser();
      if(current.error) {setMessage('로그인 상태를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');return;}
      if(!acceptedUser.current||current.data.user?.id!==acceptedUser.current) {
        acceptedUser.current=null;setReady(false);setPassword('');setConfirmation('');
        setMessage('로그인 계정이 바뀌었습니다. 계정 링크를 다시 확인해 주세요.');return;
      }
      const member=await client.from('church_editors').select('user_id').eq('user_id',acceptedUser.current).maybeSingle();
      if(member.error||!member.data) {setMessage('편집 권한을 확인하지 못했습니다. 관리자에게 문의해 주세요.');return;}
      if(acceptedUser.current!==current.data.user.id) {setMessage('로그인 상태가 바뀌었습니다. 계정 링크를 다시 확인해 주세요.');return;}
      const result = await client.auth.updateUser({ password });
      if (result.error) { setMessage("비밀번호를 저장하지 못했습니다. 다시 시도해 주세요."); return; }
      setPassword('');setConfirmation('');router.replace("/admin/bulletins");
    } catch { setMessage("연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}><section className={`${styles.card} ${styles.login}`}>
    <h1>관리자 비밀번호 설정</h1><p>초대 또는 재설정 링크를 확인한 뒤 비밀번호를 직접 정해 주세요.</p>
    <p role="status" aria-live="polite">{message}</p>
    {!client ? <p>서비스 연결 설정이 필요합니다.</p> : !ready ? <button disabled={busy} onClick={accept}>{busy ? "확인 중…" : "계정 링크 확인"}</button> :
      <form action={save}><label>새 비밀번호<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={busy} /></label><label>비밀번호 확인<input name="confirm" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} required disabled={busy} /></label><button disabled={busy}>{busy ? "저장 중…" : "비밀번호 설정하고 시작"}</button></form>}
  </section></main>;
}
