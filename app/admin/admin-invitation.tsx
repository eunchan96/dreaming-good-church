'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { makeBrowserClient } from '@/lib/bulletin-store';
import AdminIcon from './admin-icons';
import styles from './admin-invitation.module.css';

const endpoint = '/api/admin/invitations';

export default function AdminInvitation({ disabled }: { disabled: boolean }) {
  const [inviterId, setInviterId] = useState<string | null>(null);

  useEffect(() => {
    const client = makeBrowserClient();
    if (!client) return;
    let currentUserId: string | undefined;
    let check: AbortController | undefined;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === currentUserId) return;
      currentUserId = session?.user.id;
      check?.abort();
      setInviterId(null);
      if (!session) return;

      const { signal } = (check = new AbortController());
      void fetch(endpoint, { headers: { Authorization: `Bearer ${session.access_token}` }, signal })
        .then(async response => {
          if (response.ok && (await response.json()).allowed === true && !signal.aborted) {
            setInviterId(session.user.id);
          }
        })
        .catch(() => {});
    });
    return () => {
      check?.abort();
      subscription.unsubscribe();
    };
  }, []);

  return inviterId ? <InvitationDialog key={inviterId} inviterId={inviterId} disabled={disabled} /> : null;
}

function InvitationDialog({ inviterId, disabled }: { inviterId: string; disabled: boolean }) {
  const heading = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  const linkField = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');

  function open() {
    setEmail('');
    setLink('');
    setMessage('');
    dialog.current?.showModal();
    emailField.current?.focus();
  }

  function close() {
    if (pending.current) return;
    dialog.current?.close();
    setLink('');
    trigger.current?.focus();
  }

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const session = (await makeBrowserClient()?.auth.getSession())?.data.session;
      if (!session || session.user.id !== inviterId) {
        setMessage('로그인 상태가 바뀌었습니다. 다시 로그인해 주세요.');
        return;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok && typeof data.inviteUrl === 'string') {
        setLink(data.inviteUrl);
        setMessage('초대 링크가 준비되었습니다.');
      } else if (data.error === 'already_confirmed') {
        setMessage('이미 초대를 확인한 계정입니다. 비밀번호를 잊었거나 설정을 마치지 못했다면 비밀번호 재설정 링크를 사용해 주세요.');
      } else if (data.error === 'invalid_email') {
        setMessage('이메일 주소를 확인해 주세요.');
      } else if (data.error === 'forbidden') {
        setMessage('초대 권한을 확인할 수 없습니다.');
      } else {
        setMessage('초대 링크를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch {
      setMessage('초대 링크를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('초대 링크를 복사했습니다.');
    } catch {
      linkField.current?.focus();
      linkField.current?.select();
      setMessage('자동으로 복사하지 못했습니다. 선택된 링크를 직접 복사해 주세요.');
    }
  }

  return <>
    <button type="button" ref={trigger} aria-haspopup="dialog" disabled={disabled} onClick={open}>
      <AdminIcon name="invite" size={18} /> 관리자 초대
    </button>
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={heading}
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
      onCancel={event => { event.preventDefault(); close(); }}
    >
      <div className={styles.heading}>
        <h2 id={heading}>관리자 초대</h2>
        <button type="button" disabled={busy} onClick={close}>닫기</button>
      </div>
      {link ? <div className={styles.fields}>
        <p>일회용 링크를 담당자에게 직접 보내세요.</p>
        <label>초대 링크<input ref={linkField} readOnly value={link} /></label>
        <button type="button" className={styles.primary} onClick={() => void copy()}>링크 복사</button>
      </div> : <form className={styles.fields} onSubmit={issue}>
        <p>처음 초대하거나 만료된 링크를 다시 만들려면 담당자 이메일을 입력하세요.</p>
        <label>담당자 이메일
          <input ref={emailField} type="email" autoComplete="off" autoCapitalize="none" maxLength={254} required disabled={busy}
            value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? '만드는 중…' : '초대 링크 만들기'}</button>
      </form>}
      <p className={styles.status} role="status">{message}</p>
    </dialog>
  </>;
}
