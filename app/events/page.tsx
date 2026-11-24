import PublicShell from "../public-shell";
import CommunityReader from "../community-reader";
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('교회 일정', '꿈꾸는좋은교회의 다가오는 행사와 교회 일정을 달력으로 확인하세요.', '/events');
export default function Page(){return <PublicShell><CommunityReader kind="event"/></PublicShell>;}
