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
    await expect(page.getByRole("region", { name: /^2091년 4월 15일 .* 105호 주보$/ })).toBeVisible();
    await page.getByRole("button", { name: "지난 주보", exact: true }).click();
    const history = page.getByRole("region", { name: "지난 주보" });
    await expect(history.getByRole("button", { name: /· 105호$/ })).toBeVisible();
    await expect(history.getByRole("button", { name: /· 106호$/ })).toHaveCount(0);
    await expect(history.getByRole("button", { name: /호$/ })).toHaveCount(20);
    await history.getByRole("button", { name: "더 보기", exact: true }).click();
    await expect(history.getByRole("button", { name: /호$/ })).toHaveCount(40);
    await history.getByRole("button", { name: /· 70호$/ }).click();
    await expect(history).toHaveCount(0);
    await expect(page.getByRole("region", { name: /^2091년 3월 11일 .* 70호 주보$/ })).toBeVisible();
    await expect(page).toHaveURL(/\/bulletins\/2091-03-11$/);
    await page.getByRole("button", { name: "이전 주보", exact: true }).click();
    await expect(page.getByRole("region", { name: /69호 주보$/ })).toBeVisible();
    await page.getByRole("button", { name: "다음 주보", exact: true }).click();
    await expect(page.getByRole("region", { name: /70호 주보$/ })).toBeVisible();
  } finally {
    const cleanup = await admin.from("bulletins").delete().in("id", [...rows.map(row => row.id), draft.id]);
    if (cleanup.error) throw cleanup.error;
  }
});
