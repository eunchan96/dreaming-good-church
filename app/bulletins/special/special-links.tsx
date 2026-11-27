"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { longDate } from "@/lib/korean-date";
import type { SpecialProgramSummary } from "@/lib/special-programs";
import styles from "./special.module.css";

/** 주보 화면 위쪽의 작은 안내: 공개된 특별 순서지(임직감사예배 등)가 있으면 바로가기를 보여 준다. 없거나 실패하면 아무것도 그리지 않는다. */
export default function SpecialLinks() {
  const [programs, setPrograms] = useState<SpecialProgramSummary[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/special-programs", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data && Array.isArray(data.programs)) setPrograms(data.programs); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!programs.length) return null;
  return <nav className={styles.links} aria-label="특별 순서지"><span>특별 순서지</span><ul>{programs.map(program => <li key={program.slug}><Link href={`/bulletins/special/${program.slug}`}>{program.title}<small>{longDate(program.service_date)}</small></Link></li>)}</ul></nav>;
}
