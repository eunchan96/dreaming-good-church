import { test, expect } from "@playwright/test";
test("fictional seed renders public history and never exposes draft or print-only content", async ({ page }) => {
  await page.goto("/bulletins");
  await page.getByRole("button", { name: "2026-11-01 · 1호", exact: true }).click();
  await expect(page.getByText("[샘플] 지난달 헌금 합계", { exact: true })).toBeVisible();
  await expect(page.getByText("[샘플] 인쇄 전용 안내", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2026-11-15 · 3호", exact: true })).toHaveCount(0);
  await page.goto("/notices");
  await expect(page.getByText("[샘플] 함께하는 주일 안내", { exact: true })).toBeVisible();
  await expect(page.getByText("[샘플] 내부 준비 안내", { exact: true })).toHaveCount(0);
  await page.goto("/events");
  await expect(page.getByText("[샘플] 첫째 주 오후예배", { exact: true })).toBeVisible();
  await expect(page.getByText(/2026-11-01 13:40/)).toBeVisible();
  await page.goto("/church");
  await expect(page.getByText("[샘플] 개발용 교회", { exact: true })).toBeVisible();
});
