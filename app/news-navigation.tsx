'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteNavigation } from '@/lib/site-content';
import styles from './public-site.module.css';
export default function NewsNavigation() {
  const pathname = usePathname();
  return <nav className={styles.subnav} aria-label="소식 메뉴">{siteNavigation[2].links.map(link => <Link key={link.href} href={link.href} aria-current={(link.href === '/bulletins' ? pathname.startsWith(link.href) : pathname === link.href) ? 'page' : undefined}>{link.label}</Link>)}</nav>;
}
