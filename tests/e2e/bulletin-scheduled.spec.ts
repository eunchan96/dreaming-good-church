import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { acceptConfirm } from "./confirm";

test("예약 게시한 주보는 시각이 되기 전에는 공개되지 않고 목록에 예약으로 보인다", async ({ page, browser }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (user.error) throw user.error;
  const id = randomUUID();
  const readerContext = await browser.newContext();
  try {
    await admin.from("church_editors").insert({ user_id: user.data.user.id });
    await admin.from("bulletins").insert({ id, service_date: "2093-11-08", issue_number: 1 });
    const seeded = await admin.from("bulletin_items").insert([{ bulletin_id: id, position: 0, title: "공개 말씀", body: "예약 공개 내용", web_visible: true, needs_review: false }]);
    if (seeded.error) throw seeded.error;
    const reader = await readerContext.newPage();
    await page.goto("/admin/bulletins");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await page.getByRole("button", { name: /2093-11-08/ }).click();
    // 지난 시각은 거절한다.
    await page.getByLabel("예약 공개(선택)").fill("2020-01-01T09:00");
    await page.getByRole("button", { name: "예약 게시", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("지금보다 뒤로");
    // 내일 오전 9시(한국 시간)로 예약한다.
    const tomorrow = new Date(Date.now() + 9 * 3600000 + 86400000).toISOString().slice(0, 10);
    await page.getByLabel("예약 공개(선택)").fill(`${tomorrow}T09:00`);
    await acceptConfirm(page);
    await page.getByRole("button", { name: "예약 게시", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("공개로 예약했습니다");
    await expect(page.getByRole("button", { name: /\(2093-11-08\).*예약/ })).toBeVisible();
    // 예약 중에는 공개 API가 404, 저장된 시각은 입력과 같다.
    expect((await reader.request.get(`/api/bulletins?id=${id}`)).status()).toBe(404);
    const row = await admin.from("bulletins").select("status,publish_at").eq("id", id).single();
    expect(row.data?.status).toBe("published");
    expect(new Date(row.data!.publish_at!).toISOString()).toBe(new Date(`${tomorrow}T09:00:00+09:00`).toISOString());
    // 시각이 지나면 별도 작업 없이 공개된다.
    const past = await admin.from("bulletins").update({ publish_at: new Date(Date.now() - 60000).toISOString() }).eq("id", id);
    if (past.error) throw past.error;
    expect((await reader.request.get(`/api/bulletins?id=${id}`)).status()).toBe(200);
  } finally {
    await readerContext.close();
    await admin.from("bulletins").delete().eq("id", id);
    await admin.auth.admin.deleteUser(user.data.user.id);
  }
});
