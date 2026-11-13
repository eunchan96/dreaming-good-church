import type { Metadata } from "next";
import BulletinWorkspace from "./workspace";

export const metadata: Metadata = {
  title: "주보 만들기 · 꿈꾸는좋은교회",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BulletinWorkspace />;
}
