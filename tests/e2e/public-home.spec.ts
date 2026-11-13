import { test, expect } from "@playwright/test";

test("public home adapts navigation without horizontal overflow", async ({ page }) => {
  await page.route("**/api/bulletins", route => route.fulfill({ json: { bulletins: [{ id: "sample", service_date: "2026-11-08", issue_number: 45 }] } }));
  await page.route("**/api/church", route => route.fulfill({ json: { fields: [] } }));
  await page.route("**/api/community?*", route => route.fulfill({ json: { entries: [] } }));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByText("2026-11-08 · 45호")).toBeVisible();
    if (width < 900) await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
    await expect(page.getByRole("navigation", { name: width < 900 ? "모바일 주 메뉴" : "주 메뉴", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole("navigation", { name: "모바일 주 메뉴" }).getByRole("link", { name: "교회 소식", exact: true }).click();
  await expect(page.getByRole("heading", { name: "교회 공지" })).toBeVisible();
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
  await expect(page.getByRole("navigation", { name: "모바일 주 메뉴" }).getByRole("link", { name: "교회 소식", exact: true })).toHaveAttribute("aria-current", "page");
});

test("a failed home feed can recover without blocking the other feeds", async ({ page }) => {
  let fail = true;
  await page.route("**/api/bulletins", route => route.fulfill(fail ? { status: 503, json: { error: "unavailable" } } : { json: { bulletins: [] } }));
  await page.route("**/api/church", route => route.fulfill({ json: { fields: [{ key: "introduction", body: "공개된 교회 소개" }] } }));
  await page.route("**/api/community?*", route => route.fulfill({ json: { entries: [] } }));
  await page.goto("/");
  const bulletin = page.getByRole("region", { name: "이번 주 주보", exact: true });
  await expect(bulletin.getByText("소식을 불러오지 못했습니다.")).toBeVisible();
  await expect(page.getByText("공개된 교회 소개")).toBeVisible();
  fail = false;
  await bulletin.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(bulletin.getByText("현재 공개된 소식이 없습니다.")).toBeVisible();
});
