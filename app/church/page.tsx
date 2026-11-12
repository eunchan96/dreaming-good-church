import PublicShell from "../public-shell";
import ChurchReader from "./reader";
export const metadata = { title: "교회 안내" };
export default function Page() { return <PublicShell><ChurchReader /></PublicShell>; }
