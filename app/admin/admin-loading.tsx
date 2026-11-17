import styles from './admin-loading.module.css';
/** Shown while an admin page checks the session (instead of flashing the sign-in screen). */
export default function AdminLoading() {
  return <div className={styles.loading} role="status" aria-live="polite"><span className={styles.spinner} aria-hidden="true" /><span>불러오는 중…</span></div>;
}
