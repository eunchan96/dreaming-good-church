import { Skel, SkelLines, SkelRegion } from '../skeleton';
import styles from './admin-loading.module.css';

export type AdminLoadingShape = 'list' | 'form';

/** 목록 줄 자리: 제목·부가 정보 두 줄과 오른쪽 상태 표시 */
export function AdminListSkeleton({ rows = 5, label = '목록을 불러오는 중' }: { rows?: number; label?: string }) {
  return <SkelRegion label={label} className={styles.rows}>
    {Array.from({ length: rows }, (_, i) => <div key={i} className={styles.row}>
      <div className={styles.rowText}><Skel w={`${[46, 38, 52, 34, 42][i % 5]}%`} h={16} /><Skel w={`${[22, 28, 18, 26, 20][i % 5]}%`} h={11} /></div>
      <Skel w={44} h={20} className={styles.badge} />
    </div>)}
  </SkelRegion>;
}

/**
 * 관리 화면을 준비하는 동안 보여 주는 흐릿한 화면 모양.
 * list: 주보·소식·예배 영상처럼 목록이 있는 화면 / form: 홈페이지·교회 소개처럼 왼쪽 목차와 입력 칸이 있는 화면
 */
export default function AdminLoading({ shape = 'list', heading = false }: { shape?: AdminLoadingShape; heading?: boolean }) {
  return <SkelRegion label="관리 화면을 불러오는 중" className={styles.loading}>
    {heading ? <div className={styles.heading}><Skel w={120} h={11} /><Skel w={180} h={32} /></div> : null}
    <div className={styles.tabs}><Skel w={64} h={14} /><Skel w={64} h={14} /></div>
    {shape === 'list' ? <>
      <div className={styles.toolbar}><Skel w={110} h={22} /><div className={styles.actions}><Skel w={120} h={36} /><Skel w={110} h={36} /></div></div>
      <div className={styles.filters}><Skel w={170} h={30} /><Skel w={220} h={34} className={styles.search} /></div>
      <AdminListSkeleton />
    </> : <div className={styles.form}>
      <div className={styles.side}><SkelLines n={4} h={12} gap={16} last="70%" /></div>
      <div className={styles.fields}>
        <div className={styles.toolbar}><Skel w={90} h={20} /><Skel w={60} h={14} /></div>
        {[120, 56, 56, 88].map((h, i) => <div key={i} className={styles.field}><SkelLines n={2} h={12} gap={8} last="60%" /><Skel h={h} /></div>)}
      </div>
    </div>}
  </SkelRegion>;
}
