import PublicShell from '../../public-shell';
import ChurchReader from '../reader';
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('오시는 길', '꿈꾸는좋은교회 오시는 길: 경기도 고양시 덕양구 충장로 118-35, 선아빌딩 5층. 지도로 위치를 확인하세요.', '/church/directions');
export default function Page() { return <PublicShell><ChurchReader section="directions" /></PublicShell>; }
