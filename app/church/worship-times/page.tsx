import PublicShell from '../../public-shell';
import ChurchReader from '../reader';
export const metadata = { title: '예배시간 안내 | 꿈꾸는좋은교회' };
export default function Page() { return <PublicShell><ChurchReader section="worship-times" /></PublicShell>; }
