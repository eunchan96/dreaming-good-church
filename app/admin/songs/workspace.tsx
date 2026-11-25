'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { makeBrowserClient } from '@/lib/bulletin-store';
import { firstInitial, matchesSong } from '@/lib/song-search.mjs';
import type { Song, SongDetail } from '@/lib/notion-songs';
import SiteIcon from '@/app/site-icon';
import AdminShell from '../admin-shell';
import ManagementHeading from '../management-heading';
import ReauthPanel from '../reauth-panel';
import StatusMessage from '../status-message';
import ui from '../management.module.css';
import btn from '../buttons.module.css';
import page from '../bulletins/workspace.module.css';
import styles from './songs.module.css';

const PAGE_SIZE = 30;
const INITIALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const SONG_DB_URL = 'https://www.notion.so/1ff61c11cd4d80d2ac4be164e34a5427';

/** 악보를 한 장씩 보여 주고, 여러 장이면 아래 ‹ › 버튼(또는 ← → 키)으로 넘긴다. */
function SheetViewer({ sheets, title }: { sheets: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const count = sheets.length, at = Math.min(index, Math.max(0, count - 1));
  const go = (to: number) => setIndex(Math.max(0, Math.min(count - 1, to)));
  // 다음·이전 장을 미리 받아 두면 넘길 때 바로 나온다.
  useEffect(() => { for (const url of [sheets[at - 1], sheets[at + 1]]) if (url) new Image().src = url; }, [sheets, at]);
  if (!count) return <p className={styles.noSheet}>등록된 악보가 없습니다.</p>;
  return <div className={styles.viewer} role="group" aria-roledescription="악보 보기" aria-label={`${title} 악보`} tabIndex={0}
    onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); go(at - 1); } else if (event.key === 'ArrowRight') { event.preventDefault(); go(at + 1); } }}>
    <figure className={styles.sheet}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Notion 임시 주소라 Next 이미지 최적화를 쓰지 않는다 */}
      <img src={sheets[at]} alt={`${title} 악보 ${at + 1}/${count}쪽`} />
    </figure>
    {count > 1 ? <div className={styles.sheetNav}>
      <button type="button" aria-label="이전 악보" disabled={at === 0} onClick={() => go(at - 1)}>‹</button>
      <span role="status" aria-live="polite">{at + 1} / {count}</span>
      <button type="button" aria-label="다음 악보" disabled={at === count - 1} onClick={() => go(at + 1)}>›</button>
    </div> : null}
  </div>;
}

export default function SongsWorkspace() {
  const [client] = useState(makeBrowserClient);
  const [allowed, setAllowed] = useState(false), [message, setMessage] = useState('로그인을 확인하고 있습니다…'), [reload, setReload] = useState(0), [busy, setBusy] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]), [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(''), [initial, setInitial] = useState(''), [pptOnly, setPptOnly] = useState(false), [pageNo, setPageNo] = useState(1);
  const [detail, setDetail] = useState<SongDetail | null>(null), [opening, setOpening] = useState('');

  const api = useCallback(async (path: string) => {
    const { data } = await client!.auth.getSession();
    if (!data.session) throw new Error('login');
    const response = await fetch(path, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('login');
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : '불러오지 못했습니다.');
    return body;
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    (async () => {
      try {
        const user = await client.auth.getUser();
        if (user.error || !user.data.user) throw new Error('login');
        const member = await client.from('church_editors').select('user_id').eq('user_id', user.data.user.id).maybeSingle();
        if (member.error || !member.data) throw new Error('login');
        if (!active) return;
        setAllowed(true); setMessage(''); setLoading(true);
        const body = await api('/api/songs');
        if (active) setSongs(body.songs);
      } catch (error) {
        if (!active) return;
        if ((error as Error).message === 'login') { setAllowed(false); setMessage('관리자 로그인이 필요합니다. 같은 계정으로 다시 로그인해 주세요.'); }
        else setMessage((error as Error).message);
      } finally { if (active) setLoading(false); }
    })();
    const { data: { subscription } } = client.auth.onAuthStateChange(event => {
      if (!active) return;
      if (event === 'SIGNED_OUT') { setAllowed(false); setSongs([]); setDetail(null); setMessage('로그인이 종료되었습니다. 같은 계정으로 다시 로그인해 주세요.'); }
      if (event === 'SIGNED_IN') setReload(n => n + 1);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client, reload, api]);

  const filtered = useMemo(() => songs.filter(song => (!initial || firstInitial(song.title) === initial) && (!pptOnly || song.pptCount > 0) && matchesSong(song, query)), [songs, query, initial, pptOnly]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), current = Math.min(pageNo, pages), shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  async function open(song: Song) {
    if (opening) return;
    setOpening(song.id); setMessage('');
    try { setDetail(await api(`/api/songs/${song.id}`)); window.scrollTo({ top: 0 }); }
    catch (error) { setMessage((error as Error).message === 'login' ? '로그인이 종료되었습니다. 같은 계정으로 다시 로그인해 주세요.' : (error as Error).message); }
    finally { setOpening(''); }
  }

  async function download(index: number) {
    if (!detail || busy) return;
    setBusy(true); setMessage('');
    try {
      // 파일 주소는 1시간만 유효해서 누를 때마다 새로 받는다.
      const file = await api(`/api/songs/${detail.id}?ppt=${index}`);
      const link = document.createElement('a');
      link.href = file.url; link.download = file.name; link.target = '_blank'; link.rel = 'noreferrer';
      document.body.append(link); link.click(); link.remove();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!client || busy) return;
    setBusy(true);
    try { const result = await client.auth.signOut({ scope: 'local' }); if (result.error) throw result.error; }
    catch { setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  const meta = (song: Song) => [song.codes.length ? `코드 ${song.codes.join('·')}` : '', song.tempo.join('·'), song.themes.join(' · ')].filter(Boolean).join('  |  ');
  const intro = <ManagementHeading id="songs-heading" eyebrow="PRAISE ARCHIVE" title="찬양 악보" />;
  const pages_ = [
    { id: 'list', label: '곡 목록', active: !detail, onSelect: () => { setDetail(null); setMessage(''); }, sections: [{ id: 'song-list', label: '목록·검색' }] },
    // 상세는 빠른 이동 패널이 필요 없다(한 화면에 악보와 정보가 같이 보임).
    ...(detail ? [{ id: 'detail', label: '곡 상세', active: true, onSelect: () => {}, sections: [] }] : []),
  ];

  return <AdminShell active="songs" intro={intro} authenticated={allowed} onLogout={allowed ? logout : undefined} busy={busy} pages={pages_}>
    <main id="admin-content" aria-labelledby="songs-heading" tabIndex={-1} className={`${page.page} ${ui.surface}`}>
      {allowed ? <StatusMessage message={message} className={`${page.message} ${ui.feedback}`} onDone={() => setMessage('')} /> : null}
      {!allowed ? <ReauthPanel message={message} onRetry={() => { setMessage('로그인 상태를 확인하고 있습니다…'); setReload(n => n + 1); }} /> : detail ? <section className={styles.detail} aria-labelledby="song-title">
        <div className={styles.sheetPane}><SheetViewer key={detail.id} sheets={detail.sheets} title={detail.title} /></div>
        <div className={styles.infoPane}>
          <div className={styles.actions}>
            <button type="button" className={`${btn.btn} ${btn.ghost}`} onClick={() => { setDetail(null); setMessage(''); }}>← 목록으로</button>
            <a href={detail.url} target="_blank" rel="noreferrer" className={`${btn.btn} ${btn.ghost}`}><span>Notion에서 열기</span><SiteIcon name="diagonal" size={14} /></a>
          </div>
          <h2 id="song-title" className={styles.songTitle}>{detail.title}</h2>
          <dl className={styles.facts}>
            <dt>코드</dt><dd>{detail.codes.length ? detail.codes.join(' · ') : '-'}</dd>
            <dt>템포</dt><dd>{detail.tempo.length ? detail.tempo.join(' · ') : '-'}</dd>
            <dt>주제</dt><dd>{detail.themes.length ? detail.themes.join(' · ') : '-'}</dd>
            <dt>PPT</dt><dd>{detail.files.length ? <span className={styles.downloads}>{detail.files.map((file, index) => <button key={index} type="button" className={`${btn.btn} ${btn.primary}`} disabled={busy} onClick={() => void download(index)} title={file.name}>다운로드{detail.files.length > 1 ? ` ${index + 1}` : ''}<small>{file.name}</small></button>)}</span> : '없음'}</dd>
          </dl>
          <h3 className={styles.lyricsHeading}>가사</h3>
          {detail.lyrics ? <p className={styles.lyrics}>{detail.lyrics}</p> : <p className={styles.noLyrics}>등록된 가사가 없습니다.</p>}
        </div>
      </section> : <section id="song-list" tabIndex={-1} className={`${ui.flat} ${styles.list}`}>
        <div className={ui.heading}><h2>곡 목록{songs.length ? <small className={styles.count}> {filtered.length === songs.length ? `${songs.length}곡` : `${filtered.length} / ${songs.length}곡`}</small> : null}</h2>
          <div className={styles.actions}><a href={SONG_DB_URL} target="_blank" rel="noreferrer" className={`${btn.btn} ${btn.ghost}`}><span>Notion 바로가기</span><SiteIcon name="diagonal" size={14} /></a></div></div>
        <div className={styles.search}><input type="search" aria-label="곡 검색" placeholder="곡 검색" value={query} onChange={event => { setQuery(event.target.value); setPageNo(1); }} /></div>
        <div className={`${btn.chips} ${styles.chips}`} role="group" aria-label="제목 첫 글자 필터">
          <button type="button" aria-pressed={!initial} onClick={() => { setInitial(''); setPageNo(1); }}>전체</button>
          {INITIALS.map(letter => <button type="button" key={letter} aria-pressed={initial === letter} onClick={() => { setInitial(initial === letter ? '' : letter); setPageNo(1); }}>{letter}</button>)}
          <button type="button" aria-pressed={pptOnly} onClick={() => { setPptOnly(!pptOnly); setPageNo(1); }}>PPT 있는 곡</button>
        </div>
        {loading ? <p className={styles.empty} role="status">곡 목록을 불러오고 있습니다…</p> : <>
          <ul className={`${ui.rowsList} ${styles.rows}`}>{shown.map(song => <li key={song.id}><button type="button" className={styles.row} aria-busy={opening === song.id} data-opening={opening === song.id || undefined} onClick={() => void open(song)}>
            <span className={styles.rowMain}><strong>{song.title}</strong>{meta(song) ? <small>{meta(song)}</small> : null}</span>
            <span className={styles.badges}>{opening === song.id ? <small className={styles.opening} role="status">여는 중…</small> : song.pptCount ? <small className={ui.badge}>PPT{song.pptCount > 1 ? ` ${song.pptCount}` : ''}</small> : null}</span>
          </button></li>)}</ul>
          {!filtered.length ? <p className={styles.empty}>{songs.length ? '검색 조건에 맞는 곡이 없습니다.' : message || '등록된 곡이 없습니다.'}</p> : null}
          {pages > 1 ? <nav className={styles.pager} aria-label="곡 목록 페이지">
            <button type="button" aria-label="이전 페이지" disabled={current === 1} onClick={() => setPageNo(current - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - current) <= 2).map((n, i, all) => <span key={n}>{i && n - all[i - 1] > 1 ? <span className={styles.gap} aria-hidden="true">…</span> : null}<button type="button" aria-label={`${n}페이지`} aria-current={n === current ? 'page' : undefined} onClick={() => setPageNo(n)}>{n}</button></span>)}
            <button type="button" aria-label="다음 페이지" disabled={current === pages} onClick={() => setPageNo(current + 1)}>›</button>
          </nav> : null}
        </>}
      </section>}
    </main>
  </AdminShell>;
}
