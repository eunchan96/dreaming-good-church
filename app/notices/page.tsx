import PublicShell from "../public-shell";
import CommunityReader from "../community-reader";
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('교회 공지', '꿈꾸는좋은교회의 새로운 공지와 소식을 알려 드립니다.', '/notices');
export default function Page(){return <PublicShell><CommunityReader kind="notice"/></PublicShell>;}
