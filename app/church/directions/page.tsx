import PublicShell from '../../public-shell';
import ChurchReader from '../reader';
export const metadata = { title: '오시는 길 | 꿈꾸는좋은교회' };
export default function Page() { return <PublicShell><ChurchReader section="directions" /></PublicShell>; }
