'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { makeBrowserClient } from '@/lib/bulletin-store';
import { firstInitial, matchesSong } from '@/lib/song-search.mjs';
import type { Song, SongDetail } from '@/lib/notion-songs';
import SiteIcon from '@/app/site-icon';
import AdminIcon from '../admin-icons';
import { useUrlParam } from '../url-param';
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
const TITLE_WIDTHS =['46%', '62%', '38%', '54%', '70%', '42%', '58%', '34%'];

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
    {count > 1 ? <nav className={styles.sheetNav} aria-label="악보 넘기기">
      <button type="button" aria-label="이전 악보" disabled={at === 0} onClick={() => go(at - 1)}><AdminIcon name="back" size={18} /></button>
      <span role="status" aria-live="polite">{at + 1} / {count}</span>
      <button type="button" aria-label="다음 악보" disabled={at === count - 1} onClick={() => go(at + 1)}><AdminIcon name="forward" size={18} /></button>
    </nav> : null}
  </div>;
}

const Bar = ({ width, height = 14 }: { width: string; height?: number }) => <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;

export default function SongsWorkspace() {
  const router = useRouter();
  const [client] = useState(makeBrowserClient);
  const [allowed, setAllowed] = useState(false), [message, setMessage] = useState('로그인을 확인하고 있습니다…'), [reload, setReload] = useState(0), [busy, setBusy] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]), [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(''), [initial, setInitial] = useState(''), [pptOnly, setPptOnly] = useState(false), [pageNo, setPageNo] = useState(1);
  // 열어 둔 곡은 주소(?song=…)에 둔다: 뒤로가기는 곡 목록으로, 새로고침·링크 공유는 같은 곡으로 돌아온다.
  const [openId, setOpenId] = useUrlParam('song'), [loaded, setLoaded] = useState<SongDetail | null>(null);
  const listScroll = useRef(0), wasOpen = useRef(false);

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
      if (event === 'SIGNED_OUT') { setAllowed(false); setSongs([]); setOpenId(null, 'replace'); setLoaded(null); setMessage('로그인이 종료되었습니다. 같은 계정으로 다시 로그인해 주세요.'); }
      if (event === 'SIGNED_IN') setReload(n => n + 1);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client, reload, api, setOpenId]);

  // 곡을 누르면 바로 상세 화면으로 넘어가고, 악보·가사·PPT는 도착하는 대로 채운다.
  useEffect(() => {
    if (!openId || !allowed) return;
    let active = true;
    api(`/api/songs/${openId}`).then(body => { if (active) setLoaded(body); }).catch((error: Error) => {
      if (!active) return;
      setOpenId(null, 'replace');
      setMessage(error.message === 'login' ? '로그인이 종료되었습니다. 같은 계정으로 다시 로그인해 주세요.' : error.message);
    });
    return () => { active = false; };
  }, [openId, allowed, api, setOpenId]);

  const detail = loaded && loaded.id === openId ? loaded : null;
  const song = openId ? songs.find(item => item.id === openId) : undefined;
  const info = detail ?? song;
  const filtered = useMemo(() => songs.filter(item => (!initial || firstInitial(item.title) === initial) && (!pptOnly || item.pptCount > 0) && matchesSong(item, query)), [songs, query, initial, pptOnly]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), current = Math.min(pageNo, pages), shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // 상세가 그려진 뒤 맨 위로(목록을 내려 둔 채 열어도 악보가 위에서 시작하도록), 목록으로 돌아오면 보던 자리로.
  useEffect(() => {
    if (openId) window.scrollTo({ top: 0 });
    else if (wasOpen.current) window.scrollTo({ top: listScroll.current });
    wasOpen.current = !!openId;
  }, [openId]);
  function open(id: string) { listScroll.current = window.scrollY; setMessage(''); setOpenId(id); }
  function close() { setOpenId(null); setMessage(''); }

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

  // 예배 영상 관리의 하위 탭: 영상 목록·캘린더로 돌아갈 때 그 화면을 열도록 기억시켜 둔다.
  function toWorship(view: 'library' | 'calendar') {
    try { sessionStorage.setItem('church-admin:worship', JSON.stringify({ view, id: null })); } catch { /* 저장소를 못 쓰면 기본 화면 */ }
    router.push('/admin/worship');
  }

  const intro = <ManagementHeading id="songs-heading" eyebrow="WORSHIP & WORD" title="예배 영상 관리" />;
  const tabs = [
    { id: 'library', label: '영상 목록', active: false, onSelect: () => toWorship('library'), sections: [] },
    { id: 'calendar', label: '캘린더', active: false, onSelect: () => toWorship('calendar'), sections: [] },
    { id: 'songs', label: '곡 목록', active: !openId, onSelect: close, sections: [] },
    ...(openId ? [{ id: 'detail', label: '곡 상세', active: true, onSelect: () => {}, sections: [] }] : []),
  ];

  return <AdminShell active="worship" intro={intro} authenticated={allowed} onLogout={allowed ? logout : undefined} busy={busy} pages={tabs}>
    <main id="admin-content" aria-labelledby="songs-heading" tabIndex={-1} className={`${page.page} ${ui.surface}`}>
      {allowed ? <StatusMessage message={message} className={`${page.message} ${ui.feedback}`} onDone={() => setMessage('')} /> : null}
      {!allowed ? <ReauthPanel message={message} onRetry={() => { setMessage('로그인 상태를 확인하고 있습니다…'); setReload(n => n + 1); }} /> : openId ? <section className={styles.detail} aria-labelledby="song-title" aria-busy={!detail}>
        <div className={styles.sheetPane}>
          {detail ? <SheetViewer key={detail.id} sheets={detail.sheets} title={detail.title} /> : <div className={`${styles.skeleton} ${styles.sheetSkeleton}`} role="status" aria-label="악보를 불러오는 중" />}
        </div>
        <div className={styles.infoPane}>
          <div className={styles.titleRow}>
            <h2 id="song-title" className={styles.songTitle}>{info?.title ?? <Bar width="70%" height={24} />}</h2>
            {info ? <a href={info.url} target="_blank" rel="noreferrer" className={styles.notionLink} aria-label="Notion에서 열기 (새 탭)"><span>Notion</span><SiteIcon name="diagonal" size={13} /></a> : null}
          </div>
          <dl className={styles.facts}>
            <dt>코드</dt><dd>{info ? (info.codes.length ? info.codes.join(' · ') : '-') : <Bar width="40%" />}</dd>
            <dt>템포</dt><dd>{info ? (info.tempo.length ? info.tempo.join(' · ') : '-') : <Bar width="50%" />}</dd>
            <dt>주제</dt><dd>{info ? (info.themes.length ? info.themes.join(' · ') : '-') : <Bar width="65%" />}</dd>
            <dt className={styles.pptLabel}>PPT</dt>
            <dd className={styles.pptValue}>{detail
              ? (detail.files.length
                ? <span className={styles.downloads}>{detail.files.map((file, index) => <button key={index} type="button" className={`${btn.btn} ${btn.primary} ${styles.download}`} disabled={busy} onClick={() => void download(index)} title={`${file.name} 다운로드`}><span>{file.name}</span><AdminIcon name="download" size={18} /></button>)}</span>
                : <span className={styles.none}>없음</span>)
              : song && !song.pptCount ? <span className={styles.none}>없음</span>
              : <span className={styles.downloads}>{Array.from({ length: song?.pptCount ?? 1 }, (_, i) => <span key={i} className={`${styles.skeleton} ${styles.buttonSkeleton}`} aria-hidden="true" />)}</span>}</dd>
          </dl>
          <h3 className={styles.lyricsHeading}>가사</h3>
          {detail
            ? (detail.lyrics ? <p className={styles.lyrics}>{detail.lyrics}</p> : <p className={styles.noLyrics}>등록된 가사가 없습니다.</p>)
            : <div className={styles.lyricsSkeleton} role="status" aria-label="가사를 불러오는 중">{['90%', '75%', '82%', '60%', '88%', '70%'].map((width, i) => <Bar key={i} width={width} height={15} />)}</div>}
        </div>
      </section> : <section id="song-list" tabIndex={-1} className={`${ui.flat} ${styles.list}`}>
        <div className={ui.heading}><h2>곡 목록{songs.length ? <small className={styles.count}> {filtered.length === songs.length ? `${songs.length}곡` : `${filtered.length} / ${songs.length}곡`}</small> : null}</h2>
          <div className={styles.actions}><a href={SONG_DB_URL} target="_blank" rel="noreferrer" className={`${btn.btn} ${btn.ghost}`}><span>Notion 바로가기</span><SiteIcon name="diagonal" size={14} /></a></div></div>
        <div className={styles.toolbar}>
          <input type="search" aria-label="곡 검색" placeholder="곡 검색" value={query} onChange={event => { setQuery(event.target.value); setPageNo(1); }} />
          <button type="button" role="switch" aria-checked={pptOnly} aria-label="PPT 있는 곡만 보기" title="PPT 있는 곡만 보기" className={styles.pptSwitch} onClick={() => { setPptOnly(!pptOnly); setPageNo(1); }}><span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span><span>PPT만</span></button>
        </div>
        <div className={`${btn.chips} ${styles.chips}`} role="group" aria-label="제목 첫 글자 필터">
          <button type="button" aria-pressed={!initial} onClick={() => { setInitial(''); setPageNo(1); }}>전체</button>
          {INITIALS.map(letter => <button type="button" key={letter} aria-pressed={initial === letter} onClick={() => { setInitial(initial === letter ? '' : letter); setPageNo(1); }}>{letter}</button>)}
        </div>
        {loading ? <ul className={`${ui.rowsList} ${styles.rows}`} role="status" aria-label="곡 목록을 불러오는 중">{Array.from({ length: 12 }, (_, i) => <li key={i} className={styles.skeletonRow}><Bar width={TITLE_WIDTHS[i % TITLE_WIDTHS.length]} height={16} /></li>)}</ul> : <>
          <ul className={`${ui.rowsList} ${styles.rows}`}>{shown.map(item => <li key={item.id}><button type="button" className={styles.row} aria-current={openId === item.id || undefined} onClick={() => open(item.id)}>
            <strong>{item.title}</strong>
            <span className={styles.chipsRow}>{item.hasLyrics ? <small className={ui.badge}>가사</small> : null}{item.pptCount ? <small className={`${ui.badge} ${styles.pptChip}`}>PPT</small> : null}</span>
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
