"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./public-site.module.css";

const links = [["/bulletins", "주보"], ["/notices", "공지"], ["/events", "일정"], ["/church", "교회 안내"]] as const;

export default function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navigation = links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>);
  return <div className={styles.site}>
    <a className={styles.skip} href="#public-content">본문으로 바로가기</a>
    <header className={styles.header}><Link href="/" className={styles.brand}>꿈꾸는<span>좋은교회</span></Link><nav className={styles.desktopNav} aria-label="주 메뉴">{navigation}</nav><Link className={styles.homeLink} href="/">홈</Link></header>
    {children}
    <footer className={styles.footer}><Link href="/">꿈꾸는좋은교회</Link><p>예배와 교회의 소식을 함께 나눕니다.</p><Link href="/admin/bulletins">관리자</Link></footer>
    <nav className={styles.mobileNav} aria-label="모바일 주 메뉴">{navigation}</nav>
  </div>;
}
