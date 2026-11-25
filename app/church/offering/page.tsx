import PublicShell from '../../public-shell';
import ChurchReader from '../reader';
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('온라인 헌금', '꿈꾸는좋은교회 온라인 헌금 방법을 안내합니다.', '/church/offering');
export default function Page() { return <PublicShell><ChurchReader section="offering" /></PublicShell>; }
