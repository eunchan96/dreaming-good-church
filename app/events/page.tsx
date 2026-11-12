import PublicShell from "../public-shell";
import CommunityReader from "../community-reader";
export const metadata={title:"교회 일정 | 꿈꾸는좋은교회"};
export default function Page(){return <PublicShell><CommunityReader kind="event"/></PublicShell>;}
