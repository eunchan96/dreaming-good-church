import { readFileSync } from 'node:fs';
import path from 'node:path';
import AdminShell from '../admin-shell';
import ManagementHeading from '../management-heading';
import { renderGuide } from './markdown';
import styles from './guide.module.css';

export const metadata = { title: '사용 안내', robots: { index: false, follow: false } };

/** 관리 화면 사용 안내: 저장소의 docs/user-guide.md를 그대로 보여 준다(문서를 고치면 다음 배포에 반영). */
export default function Page() {
  const { title, body, headings } = renderGuide(readFileSync(path.join(process.cwd(), 'docs', 'user-guide.md'), 'utf8'));
  return <AdminShell active="guide" intro={<ManagementHeading id="guide-heading" eyebrow="USER GUIDE" title={title} />}>
    <main id="admin-content" className={styles.guide}>
      <nav className={styles.toc} aria-label="안내 목차"><ol>{headings.map(({ id, text }) => <li key={id}><a href={`#${id}`}>{text.replace(/^\d+\.\s*/, '')}</a></li>)}</ol></nav>
      <article className={styles.body}>{body}</article>
    </main>
  </AdminShell>;
}
