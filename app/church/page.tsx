import PublicShell from "../public-shell";
import ChurchReader from "./reader";
import { pageMeta } from '@/lib/site';
export const metadata = pageMeta('교회 안내', '꿈꾸는좋은교회를 소개합니다. 교회 이야기와 예배, 섬김을 안내합니다.', '/church');
export default function Page() { return <PublicShell><ChurchReader /></PublicShell>; }
