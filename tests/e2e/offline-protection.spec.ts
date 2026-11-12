import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

test("offline worker retains same-origin preview access cookie without an app authorization header", async ({ page, context }) => {
  const worker = await readFile("public/sw.js");
  const offline = await readFile("public/offline.html");
  const requests: { path: string; cookie: string; authorization?: string }[] = [];
  const server = createServer((request, response) => {
    const path = request.url!;
    if (path === "/") {
      response.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": "preview_gate=allowed; HttpOnly; SameSite=Lax; Path=/" });
      response.end('<!doctype html><html lang="ko"><title>Protected preview fixture</title><body>Preview access fixture</body></html>'); return;
    }
    if (path === "/sw.js") { response.writeHead(200, { "Content-Type": "text/javascript" }); response.end(worker); return; }
    if (path === "/offline.html") { response.writeHead(200, { "Content-Type": "text/html" }); response.end(offline); return; }
    if (path.startsWith("/api/")) {
      requests.push({ path, cookie: request.headers.cookie ?? "", authorization: request.headers.authorization });
      if (!request.headers.cookie?.includes("preview_gate=allowed")) { response.writeHead(401, { "Content-Type": "application/json" }); response.end('{}'); return; }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(path === "/api/bulletins" ? { bulletins: [] } : { fields: [{ key: "name", body: "공개 안내만 저장" }] })); return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Test server unavailable");
  const origin = `http://127.0.0.1:${address.port}`;
  async function save() {
    return page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      return new Promise<{ ok: boolean; code?: string }>(resolve => {
        channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data); };
        registration.active!.postMessage("SAVE_PUBLIC", [channel.port2]);
      });
    });
  }
  try {
    await page.goto(origin);
    await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
    expect((await save()).ok).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests.every(r => r.cookie.includes("preview_gate=allowed") && !r.authorization)).toBe(true);
    await page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
    });
    await context.setOffline(true); await page.goto(`${origin}/offline.html`);
    await expect(page.getByText("공개 안내만 저장", { exact: true })).toBeVisible();
    await context.setOffline(false);
  } finally {
    await context.setOffline(false);
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
