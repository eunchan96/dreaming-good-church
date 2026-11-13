import { test, expect } from "@playwright/test";

test("explicit public snapshot works offline and never caches admin or API responses", async ({ page, context }) => {
  await page.goto("/install");
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
  for (const path of ['/api/images?id=private', '/api/bulletins/pdf?date=2026-11-08']) {
    expect(await page.evaluate(path => fetch(path).then(() => false).catch(() => true), path)).toBe(true);
  }
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

test("a failed snapshot refresh removes the previous saved copy", async ({ page, context }) => {
  await page.goto('/install');
  const save = page.getByRole('button', { name: '공개 주보·안내 저장', exact: true });
  await expect(save).toBeEnabled({ timeout: 20000 }); await save.click();
  await expect(page.getByText(/공개 주보와 안내를 저장했습니다/)).toBeVisible();
  await context.setOffline(true); await save.click();
  await expect(page.getByText('저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.', { exact: true })).toBeVisible();
  await page.goto('/offline.html');
  await expect(page.getByRole('status')).toContainText('저장한 내용이 없거나');
  await context.setOffline(false);
});

test("insecure mobile HTTP explains why offline storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'isSecureContext', { value: false }));
  await page.goto('/install');
  await expect(page.getByText(/오프라인 저장은 HTTPS 주소에서 사용할 수 있습니다/)).toBeVisible();
  await expect(page.getByRole('button', { name: '공개 주보·안내 저장', exact: true })).toBeDisabled();
});
