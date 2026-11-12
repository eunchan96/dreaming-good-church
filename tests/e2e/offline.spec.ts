import { test, expect } from "@playwright/test";

test("explicit public snapshot works offline and never caches admin or API responses", async ({ page, context }) => {
  await page.goto("/church");
  await page.getByText("홈 화면에 추가 · 설치 안내", { exact: true }).click();
  const save = page.getByRole("button", { name: "공개 주보·안내 저장", exact: true });
  await expect(save).toBeEnabled({ timeout: 20000 });
  await save.click();
  await expect(page.getByText(/공개 주보와 안내를 저장했습니다/)).toBeVisible();
  await page.evaluate(async () => {
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  const keys = await page.evaluate(async () => (await (await caches.open('church-offline-v1')).keys()).map(request => new URL(request.url).pathname).sort());
  expect(keys).toEqual(['/offline-data.json', '/offline.html']);
  await context.setOffline(true);
  await page.goto("/bulletins/2026-11-08", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "오프라인에서 보기" })).toBeVisible();
  await expect(page.getByText("2026-11-08 · 2호", { exact: true })).toBeVisible();
  await expect(page.getByText("[샘플] 인쇄 전용 안내", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => fetch('/api/church').then(() => false).catch(() => true))).toBe(true);
  const admin = await context.newPage();
  await expect(admin.goto('/admin/bulletins')).rejects.toThrow();
  await admin.close();
  await page.evaluate(async () => {
    const cache = await caches.open('church-offline-v1');
    const response = await cache.match('/offline-data.json');
    const data = await response!.json(); data.savedAt = Date.now() - 25 * 3600000;
    await cache.put('/offline-data.json', new Response(JSON.stringify(data)));
  });
  await page.reload();
  await expect(page.getByRole("status")).toContainText("저장한 내용이 없거나");
  await expect(page.getByText("2026-11-08 · 2호", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "저장 내용 지우기", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("저장 내용을 지웠습니다.");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("저장한 내용이 없거나");
  await context.setOffline(false);
});
