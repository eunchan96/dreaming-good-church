import PublicShell from '../../public-shell';
import ChurchReader from '../reader';
export const metadata = { title: '온라인 헌금 | 꿈꾸는좋은교회' };
export default function Page() { return <PublicShell><ChurchReader section="offering" /></PublicShell>; }
