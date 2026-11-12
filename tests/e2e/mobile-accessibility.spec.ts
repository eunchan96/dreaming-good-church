import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [390, 1280]) {
  test(`public pages pass accessibility checks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/bulletins", "/church", "/notices", "/events"]) {
      await page.goto(path);
      await expect(page.locator("#public-content h1")).toBeVisible();
      await expect(page.getByText(/불러오고 있습니다/)).toHaveCount(0);
      if (path === "/church") await page.getByText("홈 화면에 추가 · 설치 안내", { exact: true }).click();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target), summary: v.nodes.map(n => n.failureSummary) })), path).toEqual([]);
    }
  });
}

test("keyboard skip, mobile navigation, enlarged text and clipboard fallback remain usable", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/bulletins");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 바로가기", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#public-content")).toBeFocused();
  const tabs = page.getByRole("navigation", { name: "모바일 주 메뉴", exact: true });
  for (const link of await tabs.getByRole("link").all()) {
    const box = await link.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await tabs.getByRole("link", { name: "교회 안내", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "교회 안내", exact: true })).toBeVisible();
  await page.goto("/bulletins/2026-11-08");
  await expect(page.getByRole("button", { name: "링크 복사", exact: true })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } }));
  await page.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect(page.getByText(/고유 주소를 열고 주소창에서 복사/)).toBeVisible();
  await expect(page.getByRole("link", { name: "이 주보의 고유 주소", exact: true })).toHaveAttribute("href", "/bulletins/2026-11-08");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const width of [320, 390, 844]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
