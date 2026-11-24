import PublicShell from '../../public-shell';
import ChurchReader from '../reader';
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('예배시간 안내', '꿈꾸는좋은교회 주일예배, 오후예배, 금요예배, 새벽예배 등 예배 시간 안내입니다.', '/church/worship-times');
export default function Page() { return <PublicShell><ChurchReader section="worship-times" /></PublicShell>; }
