import { test, expect } from "@playwright/test";
test("calendar selects dates and moves months in Korean time", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-12T00:00:00Z"));
  await page.route("**/api/community?*", route => route.fulfill({ json: { entries: [{ id: "one", title: "공개 모임", body: "안내", location: "예배실", starts_at: "2026-11-14T15:30:00Z", ends_at: "2026-11-16T15:00:00Z" }] } }));
  await page.goto("/events");
  await page.getByRole("button", { name: "달력 보기", exact: true }).click();
  await page.getByRole("button", { name: "2026-11-15 일정 1개", exact: true }).click();
  await expect(page.getByRole("heading", { name: "공개 모임" })).toBeVisible();
  await page.getByRole("button", { name: "2026-11-17 일정 0개", exact: true }).click();
  await expect(page.getByRole("heading", { name: "공개 모임" })).toHaveCount(0);
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2026년 12월" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "공개 모임" })).toBeVisible();
});
