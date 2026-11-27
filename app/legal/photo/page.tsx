import PolicyPage from '../policy-page';
import { pageMeta } from '@/lib/site';
// 검색에는 올리지 않지만(noindex), 링크를 공유하면 이 제목·설명이 미리보기에 나온다.
export const metadata = { ...pageMeta('사진 게시정책', '꿈꾸는좋은교회 홈페이지에 사진을 올릴 때의 동의와 공개 범위, 삭제 요청 방법을 안내합니다.', '/legal/photo'), robots: { index: false, follow: false } };
export default function Page() { return <PolicyPage type="photo" />; }
