import { test, expect } from "@playwright/test";

test("reader supports section jumps and month history at desktop and mobile widths", async ({ page }) => {
  const rows = [{ id: "new", service_date: "2026-11-08", issue_number: 2 }, { id: "old", service_date: "2026-10-25", issue_number: 1 }];
  await page.route("**/api/bulletins*", route => {
    const id = new URL(route.request().url()).searchParams.get("id");
    return route.fulfill({ json: id ? { ...rows.find(row => row.id === id), items: [
      { id: `${id}-first`, title: "예배 순서", kind: "worship", body: "함께 예배합니다.", content: { rows: [["찬송", "함께", "다 같이"]] } },
      { id: `${id}-second`, title: "이번 주 말씀", kind: "text", body: "말씀 본문입니다.", content: {} },
    ] } : { bulletins: rows } });
  });
  await page.goto("/bulletins", { waitUntil: "domcontentloaded" });
  const contents = page.getByRole("navigation", { name: "주보 구역 바로가기" });
  await expect(contents.getByRole("link", { name: /이번 주 말씀/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "2026-10-25 · 1호" })).not.toBeVisible();
  await contents.getByRole("link", { name: /이번 주 말씀/ }).click();
  await expect(page.locator("#bulletin-item-new-second")).toBeFocused();
  await page.getByText("지난 주보 보기", { exact: false }).click();
  await page.getByLabel("주보 발행 월").fill("2026-10");
  await expect(page.getByRole("button", { name: "2026-11-08 · 2호" })).toHaveCount(0);
  await page.getByRole("button", { name: "2026-10-25 · 1호" }).click();
  await expect(page.getByRole("heading", { name: "2026-10-25 · 1호" })).toBeVisible();
  await page.getByRole("button", { name: "2026-10-25 · 1호" }).click();
  await expect(page.getByRole("heading", { name: "2026-10-25 · 1호" })).toBeVisible();
  await expect(contents.locator('a[href="#bulletin-item-new-second"]')).toHaveCount(0);
  await page.getByLabel("주보 발행 월").fill("2025-01");
  await expect(page.getByText("선택한 월에 표시할 주보가 없습니다.")).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(contents).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
