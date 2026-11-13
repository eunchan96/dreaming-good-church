import { worshipTypes } from '@/lib/site-content';
import styles from './public-site.module.css';
export default function WorshipTimes() {
  return <section className={styles.worshipTimes} aria-labelledby="worship-times-title"><p className={styles.eyebrow}>GATHER IN WORSHIP</p><h2 id="worship-times-title">함께 예배하는 시간</h2><div className={styles.timeGrid}>{worshipTypes.map(w => <div key={w.key}><span>{w.english}</span><h3>{w.name}</h3><p>{w.time}</p></div>)}</div></section>;
}
