import PublicShell from "../public-shell";
import PublicBulletins from "./public-bulletins";
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('주보', '매주 꿈꾸는좋은교회 주보의 예배 순서와 말씀, 교회 소식을 볼 수 있습니다.', '/bulletins');
export default function Page() { return <PublicShell><PublicBulletins /></PublicShell>; }
