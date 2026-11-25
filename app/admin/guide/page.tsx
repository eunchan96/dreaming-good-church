import { readFileSync } from 'node:fs';
import path from 'node:path';
import AdminShell from '../admin-shell';
import ManagementHeading from '../management-heading';
import { renderGuide } from './markdown';
import GuideToc from './guide-toc';
import styles from './guide.module.css';

/** public 아래 PNG의 가로·세로(파일 머리의 IHDR). */
function pngSize(src: string) {
  try { const head = readFileSync(path.join(process.cwd(), 'public', src)).subarray(16, 24); return { width: head.readUInt32BE(0), height: head.readUInt32BE(4) }; }
  catch { return undefined; }
}

export const metadata = { title: '사용 안내', robots: { index: false, follow: false } };

/** 관리 화면 사용 안내: 저장소의 docs/user-guide.md를 그대로 보여 준다(문서를 고치면 다음 배포에 반영). */
export default function Page() {
  const { title, body, headings } = renderGuide(readFileSync(path.join(process.cwd(), 'docs', 'user-guide.md'), 'utf8'), pngSize);
  return <AdminShell active="guide" intro={<ManagementHeading id="guide-heading" eyebrow="USER GUIDE" title={title} />}>
    <main id="admin-content" className={styles.guide}>
      <GuideToc headings={headings} className={styles.toc} />
      <article className={styles.body}>{body}</article>
    </main>
  </AdminShell>;
}
