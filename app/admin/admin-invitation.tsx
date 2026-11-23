'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { makeBrowserClient } from '@/lib/bulletin-store';
import btn from './buttons.module.css';
import { useConfirm } from './confirm-dialog';
import styles from './admin-invitation.module.css';

const endpoint = '/api/admin/invitations';
type Editor = { id: string; email: string; status: 'active' | 'pending'; self: boolean; inviter: boolean };

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

/** 관리자 초대: current editors (with removal) and a one-time invitation link for a new editor. */
function InvitationDialog({ inviterId, disabled }: { inviterId: string; disabled: boolean }) {
  const [confirm, confirmDialog] = useConfirm();
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
  const [editors, setEditors] = useState<Editor[] | null>(null);
  const [listFailed, setListFailed] = useState(false);

  // Every request re-checks that the same inviter is still signed in.
  const authorized = useCallback(async () => {
    const session = (await makeBrowserClient()?.auth.getSession())?.data.session;
    if (!session || session.user.id !== inviterId) {
      setMessage('로그인 상태가 바뀌었습니다. 다시 로그인해 주세요.');
      return null;
    }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [inviterId]);

  const loadEditors = useCallback(async () => {
    setListFailed(false);
    try {
      const headers = await authorized();
      if (!headers) return;
      const response = await fetch(endpoint, { headers, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.editors)) throw new Error();
      setEditors(data.editors);
    } catch {
      setEditors(null);
      setListFailed(true);
    }
  }, [authorized]);

  function open() {
    setEmail('');
    setLink('');
    setMessage('');
    dialog.current?.showModal();
    emailField.current?.focus();
    void loadEditors();
  }

  function close() {
    if (pending.current) return;
    dialog.current?.close();
    setLink('');
    trigger.current?.focus();
  }

  async function run(task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try { await task(); }
    finally { pending.current = false; setBusy(false); }
  }

  function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      try {
        const headers = await authorized();
        if (!headers) return;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (response.ok && typeof data.inviteUrl === 'string') {
          setLink(data.inviteUrl);
          setMessage('초대 링크가 준비되었습니다.');
          void loadEditors();
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
      }
    });
  }

  async function remove(editor: Editor) {
    const pending = editor.status === 'pending';
    const ok = await confirm(pending
      ? { title: `${editor.email} 초대를 취소할까요?`, message: '보낸 초대 링크도 더 이상 쓸 수 없습니다.', confirmLabel: '초대 취소', tone: 'danger' }
      : { title: `${editor.email}의 관리자 권한을 해제할까요?`, message: '이 계정으로는 더 이상 관리자 화면을 쓸 수 없습니다.', confirmLabel: '권한 해제', tone: 'danger' });
    if (!ok) return;
    void run(async () => {
      try {
        const headers = await authorized();
        if (!headers) return;
        const response = await fetch(`${endpoint}?id=${encodeURIComponent(editor.id)}`, { method: 'DELETE', headers });
        if (!response.ok) throw new Error();
        setMessage(editor.status === 'pending' ? '초대를 취소했습니다.' : '관리자 권한을 해제했습니다.');
        await loadEditors();
      } catch {
        setMessage('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    });
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
    <button type="button" ref={trigger} aria-haspopup="dialog" disabled={disabled} onClick={open}>관리자 초대</button>
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={heading}
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
      onCancel={event => { event.preventDefault(); close(); }}
    >
      <div className={styles.heading}>
        <h2 id={heading}>관리자 초대</h2>
        <button type="button" className={`${btn.btn} ${btn.ghost}`} disabled={busy} onClick={close}>닫기</button>
      </div>

      <section className={styles.section} aria-label="현재 관리자">
        <h3>현재 관리자</h3>
        {editors ? <ul className={styles.editors}>{editors.map(editor => <li key={editor.id}>
          <span className={styles.email}>{editor.email || '이메일 없음'}</span>
          <span className={styles.tags}>
            {editor.self ? <span className={styles.tag}>나</span> : null}
            {editor.inviter ? <span className={styles.tag}>초대 담당</span> : null}
            <span className={styles.tag} data-status={editor.status}>{editor.status === 'active' ? '사용 중' : '초대 대기'}</span>
          </span>
          {editor.self || editor.inviter ? null : <button type="button" className={`${btn.btn} ${btn.ghost} ${styles.remove}`} disabled={busy} onClick={() => remove(editor)} aria-label={`${editor.email} ${editor.status === 'pending' ? '초대 취소' : '권한 해제'}`}>{editor.status === 'pending' ? '초대 취소' : '권한 해제'}</button>}
        </li>)}</ul>
          : <p className={styles.note} role="status">{listFailed ? <>목록을 불러오지 못했습니다. <button type="button" className={styles.inlineButton} onClick={() => void loadEditors()}>다시 불러오기</button></> : '관리자 목록을 불러오고 있습니다…'}</p>}
      </section>

      <section className={styles.section} aria-label="새 관리자 초대">
        <h3>새 관리자 초대</h3>
        {link ? <div className={styles.fields}>
          <p className={styles.note}>일회용 링크를 담당자에게 직접 보내세요. 링크를 연 뒤 비밀번호를 정하면 바로 관리자 화면을 쓸 수 있습니다.</p>
          <label>초대 링크<input ref={linkField} readOnly value={link} /></label>
          <div className={styles.actions}>
            <button type="button" className={`${btn.btn} ${btn.primary}`} onClick={() => void copy()}>링크 복사</button>
            <button type="button" className={`${btn.btn} ${btn.ghost}`} onClick={() => { setLink(''); setEmail(''); setMessage(''); }}>다른 사람 초대</button>
          </div>
        </div> : <form className={styles.fields} onSubmit={issue}>
          <p className={styles.note}>처음 초대하거나 만료된 링크를 다시 만들려면 담당자 이메일을 입력하세요.</p>
          <label>담당자 이메일
            <input ref={emailField} type="email" autoComplete="off" autoCapitalize="none" maxLength={254} required disabled={busy}
              value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <div className={styles.actions}>
            <button type="submit" className={`${btn.btn} ${btn.primary}`} disabled={busy}>{busy ? '처리 중…' : '초대 링크 만들기'}</button>
          </div>
        </form>}
      </section>
      <p className={styles.status} role="status">{message}</p>
    </dialog>
    {confirmDialog}
  </>;
}
