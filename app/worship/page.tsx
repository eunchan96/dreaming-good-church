import WorshipPage from './worship-page';
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('주일예배', '꿈꾸는좋은교회 주일예배 설교 영상과 예배 시간을 안내합니다.', '/worship');
export default function Page() { return <WorshipPage />; }
