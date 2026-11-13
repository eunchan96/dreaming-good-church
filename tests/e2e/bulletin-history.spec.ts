import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test("server history traverses more than 100 records, filters months and excludes drafts", async ({ page, request }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const rows = Array.from({ length: 105 }, (_, index) => ({ id: randomUUID(), service_date: new Date(Date.UTC(2091, 0, index + 1)).toISOString().slice(0, 10), issue_number: index + 1, status: "published" as const }));
  const draft = { id: randomUUID(), service_date: "2091-04-20", issue_number: 106, status: "draft" as const };
  try {
    const inserted = await admin.from("bulletins").insert([...rows, draft]);
    if (inserted.error) throw inserted.error;
    let cursor: string | null = null;
    const dates: string[] = [];
    do {
      const response = await request.get(`/api/bulletins?before=${cursor ?? "2092-01-01"}`);
      expect(response.ok()).toBe(true);
      const data: { bulletins: { service_date: string }[]; nextCursor: string | null } = await response.json();
      dates.push(...data.bulletins.filter((row: { service_date: string }) => row.service_date.startsWith("2091-")).map((row: { service_date: string }) => row.service_date));
      cursor = data.nextCursor;
    } while (cursor && cursor >= "2091-01-01");
    expect(dates).toHaveLength(105);
    expect(new Set(dates).size).toBe(105);
    const january = await (await request.get("/api/bulletins?month=2091-01")).json();
    expect(january.bulletins).toHaveLength(20);
    const rest = await (await request.get(`/api/bulletins?month=2091-01&before=${january.nextCursor}`)).json();
    expect(rest.bulletins).toHaveLength(11);
    expect(rest.nextCursor).toBeNull();
    expect(rest.bulletins.every((row: { service_date: string }) => row.service_date.startsWith("2091-01"))).toBe(true);
    expect((await request.get("/api/bulletins?month=2091-13")).status()).toBe(400);
    expect((await request.get("/api/bulletins?before=2091-02-30")).status()).toBe(400);
    await page.goto("/bulletins");
    await page.getByText("지난 주보 보기", { exact: true }).click();
    await page.getByLabel("주보 발행 월").fill("2091-01");
    await expect(page.getByRole("button", { name: "2091-01-31 · 31호", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "다음 페이지", exact: true }).click();
    await page.getByRole("button", { name: "2091-01-01 · 1호", exact: true }).click();
    await expect(page.getByRole("heading", { name: "2091-01-01 · 1호", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "이전 페이지", exact: true }).click();
    await expect(page.getByRole("button", { name: "2091-01-31 · 31호", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2091-01-01 · 1호", exact: true })).toBeVisible();
    await page.getByLabel("주보 발행 월").fill("2091-04");
    await expect(page.getByRole("button", { name: "2091-04-15 · 105호", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "2091-04-20 · 106호", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "이전 페이지", exact: true })).toHaveCount(0);
  } finally {
    const cleanup = await admin.from("bulletins").delete().in("id", [...rows.map(row => row.id), draft.id]);
    if (cleanup.error) throw cleanup.error;
  }
});
