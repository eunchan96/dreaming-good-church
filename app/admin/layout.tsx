import type { Metadata } from 'next';

/** 관리자 화면: 제목은 각 화면이 정한 그대로 쓰고(교회 이름이 두 번 붙지 않게), 검색 엔진에는 내보내지 않는다. */
export const metadata: Metadata = { title: { template: '%s', default: '관리자 · 꿈꾸는좋은교회' }, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<'/admin'>) { return children; }
