import PolicyPage from '../policy-page';
import { pageMeta } from '@/lib/site';
// 검색에는 올리지 않지만(noindex), 링크를 공유하면 이 제목·설명이 미리보기에 나온다.
export const metadata = { ...pageMeta('개인정보처리방침', '꿈꾸는좋은교회 홈페이지가 어떤 개인정보를 어떻게 다루는지 안내합니다.', '/legal/privacy'), robots: { index: false, follow: false } };
export default function Page() { return <PolicyPage type="privacy" />; }
