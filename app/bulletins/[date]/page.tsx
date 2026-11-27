import type { Metadata } from "next";
import { connection } from "next/server";
import { publicClient } from "@/lib/server-access";
import PublicShell from "../../public-shell";
import PublicBulletins from "../public-bulletins";
import { pageMeta } from "@/lib/site";

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
  if (issue === undefined) return { title: "주보를 확인해 주세요", description: "현재 공개된 주보를 확인해 주세요.", robots: { index: false, follow: false } };
  // 탭·검색 결과·카카오톡 미리보기에 나오는 제목: "2026년 11월 22일 47호 주보"
  const [year, month, day] = date.split("-").map(Number);
  const when = `${year}년 ${month}월 ${day}일`;
  const meta = pageMeta(`${when} ${issue}호 주보`, `${when} 주일 꿈꾸는좋은교회 주보의 예배 순서와 말씀, 교회 소식입니다.`, `/bulletins/${date}`);
  return { ...meta, openGraph: { ...meta.openGraph, type: "article" } };
}

export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  await connection();
  const { date } = await params;
  return <PublicShell><PublicBulletins initialDate={date} /></PublicShell>;
}
