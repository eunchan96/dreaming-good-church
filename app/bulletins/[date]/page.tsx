import type { Metadata } from "next";
import { connection } from "next/server";
import { publicClient } from "@/lib/server-access";
import PublicShell from "../../public-shell";
import PublicBulletins from "../public-bulletins";

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  await connection();
  const { date } = await params;
  let issue: number | undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    try {
      const { data, error } = await publicClient().from("bulletins").select("issue_number").eq("service_date", date).eq("status", "published").maybeSingle();
      if (!error && data) issue = data.issue_number;
    } catch { /* Public metadata stays generic on lookup failure. */ }
  }
  if (issue === undefined) return { title: "주보를 확인해 주세요 | 꿈꾸는좋은교회", description: "현재 공개된 주보를 확인해 주세요.", robots: { index: false, follow: false } };
  const title = `${date} · ${issue}호 주보 | 꿈꾸는좋은교회`;
  const description = "꿈꾸는좋은교회의 예배 순서와 말씀, 공개된 교회 소식을 만나보세요.";
  return { title, description, openGraph: { title, description, type: "article", locale: "ko_KR", siteName: "꿈꾸는좋은교회" }, twitter: { card: "summary", title, description } };
}

export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  await connection();
  const { date } = await params;
  return <PublicShell><PublicBulletins initialDate={date} /></PublicShell>;
}
