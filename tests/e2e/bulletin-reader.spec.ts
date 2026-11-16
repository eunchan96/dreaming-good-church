import { test, expect } from "@playwright/test";

test("reader supports section jumps and month history at desktop and mobile widths", async ({ page }) => {
  const rows = [{ id: "new", service_date: "2026-11-08", issue_number: 2 }, { id: "old", service_date: "2026-10-25", issue_number: 1 }];
  await page.route("**/api/bulletins*", route => {
    const query = new URL(route.request().url()).searchParams;
    const id = query.get("id");
    return route.fulfill({ json: id ? { ...rows.find(row => row.id === id), items: [
      { id: `${id}-first`, title: "예배 순서", kind: "worship", body: "함께 예배합니다.", content: { rows: [["찬송", "함께", "다 같이"]] } },
      { id: `${id}-second`, title: "이번 주 말씀", kind: "text", body: "말씀 본문입니다.", content: {} },
    ] } : { bulletins: rows.filter(row => !query.get("month") || row.service_date.startsWith(query.get("month")!)), nextCursor: null } });
  });
  await page.goto("/bulletins", { waitUntil: "domcontentloaded" });
  const contents = page.getByRole("navigation", { name: "주보 구역 바로가기" });
  await expect(contents.getByRole("link", { name: "좋은 소식" })).toBeVisible();
  await expect(page.getByRole("region", { name: "지난 주보" })).toHaveCount(0);
  await contents.getByRole("link", { name: "좋은 소식" }).click();
  await expect(page.locator("#bulletin-section-6")).toBeFocused();
  await expect(page.locator("#bulletin-section-6")).toContainText("말씀 본문입니다.");
  await expect(page.getByRole("button", { name: "다음 주보", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "지난 주보", exact: true }).click();
  const history = page.getByRole("region", { name: "지난 주보" });
  await expect(history.getByRole("heading", { name: "2026년 10월" })).toBeVisible();
  await history.getByRole("button", { name: "2026년 10월 25일 주일 · 1호", exact: true }).click();
  await expect(page.getByRole("region", { name: "2026년 10월 25일 주일 1호 주보" })).toBeVisible();
  await expect(page.getByRole("button", { name: "이전 주보", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "다음 주보", exact: true }).click();
  await expect(page.getByRole("region", { name: "2026년 11월 8일 주일 2호 주보" })).toBeVisible();
  await expect(contents.getByRole("link", { name: "예배 순서" })).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(contents).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
