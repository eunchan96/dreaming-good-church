import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { publicClient } from "@/lib/server-access";
import { parseProgramContent, validProgramSlug } from "@/lib/special-programs";
import PublicShell from "../../../public-shell";
import NewsNavigation from "../../../news-navigation";
import site from "../../../public-site.module.css";
import SpecialReader from "../special-reader";

export const instant = false;

async function load(slug: string) {
  if (!validProgramSlug(slug)) return null;
  const { data, error } = await publicClient().from("special_programs").select("slug,title,service_date,content,pdf_path").eq("slug", slug).maybeSingle();
  if (error) throw error;
  const content = data ? parseProgramContent(data.content) : null;
  return data && content ? { ...data, content } : null;
}

// 성도 이름이 들어 있어 검색 결과에는 올리지 않는다.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  let title = "특별 순서지";
  try { title = (await load(slug))?.title ?? title; } catch { /* 제목 조회에 실패해도 기본 제목을 쓴다. */ }
  return { title: `${title} · 순서지`, description: "꿈꾸는좋은교회 특별 예배 순서지입니다.", robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const program = await load(slug);
  if (!program) notFound();
  return <PublicShell><main id="public-content" tabIndex={-1} className={site.subpage}>
    <header className={site.pageHeading}><p className={site.eyebrow}>SPECIAL PROGRAM</p><h1>{program.title}</h1><p>{program.service_date.replaceAll("-", ". ")} 순서지를 웹과 인쇄 모양으로 볼 수 있습니다.</p></header>
    <NewsNavigation />
    <div className={site.newsBody}><SpecialReader slug={program.slug} title={program.title} content={program.content} hasPdf={!!program.pdf_path} /></div>
  </main></PublicShell>;
}
