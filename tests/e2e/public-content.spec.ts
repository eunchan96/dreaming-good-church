import { test, expect } from "@playwright/test";

test("public information pages recover from failure and fit desktop and mobile", async ({ page }) => {
  let failed = true;
  await page.route("**/api/church", route => route.fulfill(failed ? { status: 503, json: {} } : { json: { fields: [
    { key: "worship", body: "주일 예배 오전 10:45" }, { key: "introduction", body: "함께 예배하는 공동체" }, { key: "phone", body: "" },
  ] } }));
  await page.goto("/church", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toContainText("불러오지 못했습니다");
  failed = false;
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(page.getByText("함께 예배하는 공동체", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "연락처", exact: true })).toHaveCount(0);
  await page.getByRole("navigation", { name: "교회 소개 메뉴" }).getByRole("link", { name: "예배시간 안내" }).click();
  await expect(page.getByText("주일 예배 오전 10:45", { exact: true })).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.route("**/api/community?kind=event", route => route.fulfill({ json: { entries: [{ id: "event", title: "함께하는 예배", starts_at: "2026-11-15T04:40:00Z", ends_at: null, location: "", body: "긴 안내문\n" + "함께해요".repeat(100) }] } }));
  await page.goto("/events", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("2026-11-15 13:40 (한국 시간)")).toBeVisible();
  await expect(page.getByText("장소 안내를 준비 중입니다.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route("**/api/community?kind=notice", route => route.fulfill({ json: { entries: [] } }));
  await page.goto("/notices", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("현재 공개된 내용이 없습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 불러오기" })).toHaveCount(0);
});
