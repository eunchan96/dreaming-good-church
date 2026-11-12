import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test("publish and withdraw expose only reviewed public content in API and reader", async ({ page, browser }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (user.error) throw user.error;
  const id = randomUUID(), publicId = randomUUID(), privateId = randomUUID();
  const readerContext = await browser.newContext();
  try {
    await admin.from("church_editors").insert({ user_id: user.data.user.id });
    await admin.from("bulletins").insert({ id, service_date: "2094-11-07", issue_number: 1 });
    const seeded = await admin.from("bulletin_items").insert([
      { id: publicId, bulletin_id: id, position: 0, title: "공개 말씀", body: "성도에게 보여줄 내용", web_visible: true, needs_review: true },
      { id: privateId, bulletin_id: id, position: 1, title: "숨겨진 제목", body: "노출되면 안 되는 내용", web_visible: false, needs_review: false },
    ]);
    if (seeded.error) throw seeded.error;
    const reader = await readerContext.newPage();
    expect((await reader.request.get(`/api/bulletins?id=${id}`)).status()).toBe(404);
    await page.goto("/admin/bulletins");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await page.getByRole("button", { name: /2094-11-07/ }).click();
    await expect(page.getByRole("button", { name: "주보 게시", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "그대로 사용" }).click();
    await expect(page.getByRole("button", { name: "주보 게시", exact: true })).toBeEnabled();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "주보 게시", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("주보를 게시했습니다");
    await expect(page.getByLabel("내용", { exact: true }).first()).toBeDisabled();
    const response = await reader.request.get(`/api/bulletins?id=${id}`);
    expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toContain("no-store");
    const payload = await response.text();
    expect(payload).toContain("성도에게 보여줄 내용");
    expect(payload).not.toContain("노출되면"); expect(payload).not.toContain("숨겨진"); expect(payload).not.toContain("needs_review");
    expect((await reader.request.get("/api/bulletins?date=2094-11-07")).status()).toBe(200);
    const shareHtml = await (await reader.request.get("/bulletins/2094-11-07")).text();
    expect(shareHtml).toContain('property="og:title"');
    expect(shareHtml).not.toContain("숨겨진 제목");
    await reader.goto("/bulletins/2094-11-07");
    await expect(reader.getByText("성도에게 보여줄 내용", { exact: true })).toBeVisible();
    await readerContext.grantPermissions(["clipboard-read", "clipboard-write"]);
    await reader.getByRole("button", { name: "링크 복사", exact: true }).click();
    await expect(reader.getByText("주보 링크를 복사했습니다.")).toBeVisible();
    expect(await reader.evaluate(() => navigator.clipboard.readText())).toBe("http://localhost:3001/bulletins/2094-11-07");
    await reader.goto("/bulletins");
    await reader.getByText("지난 주보 보기", { exact: false }).click();
    await reader.getByRole("button", { name: "2094-11-07 · 1호", exact: true }).click();
    await expect(reader.getByText("성도에게 보여줄 내용", { exact: true })).toBeVisible();
    await expect(reader.getByText("숨겨진 제목", { exact: true })).toHaveCount(0);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "게시 취소", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("게시를 취소했습니다");
    expect((await reader.request.get(`/api/bulletins?id=${id}`)).status()).toBe(404);
    expect((await reader.request.get("/api/bulletins?date=2094-11-07")).status()).toBe(404);
    const withdrawnHtml = await (await reader.request.get("/bulletins/2094-11-07")).text();
    expect(withdrawnHtml).not.toContain('property="og:title"');
    await reader.goto("/bulletins/2094-11-07");
    await expect(reader.getByText("성도에게 보여줄 내용", { exact: true })).toHaveCount(0);
  } finally {
    await readerContext.close();
    await admin.from("bulletins").delete().eq("id", id);
    await admin.auth.admin.deleteUser(user.data.user.id);
  }
});
