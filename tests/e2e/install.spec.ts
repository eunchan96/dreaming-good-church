import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("manifest and temporary icons supply valid install assets", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe("꿈꾸는좋은교회");
  expect(manifest.start_url).toBe("/"); expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.ok()).toBe(true);
    const info = await sharp(await asset.body()).metadata();
    expect(`${info.width}x${info.height}`).toBe(icon.sizes);
  }
});

test("installation guide handles browser prompt, dismissal and installed state", async ({ page }) => {
  await page.goto("/church");
  await page.getByText("홈 화면에 추가 · 설치 안내", { exact: true }).click();
  await expect(page.getByText(/Safari의 공유 메뉴/)).toBeVisible();
  await expect(page.getByRole("button", { name: "좋은교회 앱 설치", exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }) });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "좋은교회 앱 설치", exact: true }).click();
  await expect(page.getByText(/설치를 취소했습니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "좋은교회 앱 설치", exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByText("앱 화면으로 사용 중입니다.")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
