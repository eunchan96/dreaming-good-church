import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { acceptConfirm, dismissConfirm } from "./confirm";

test("저장된 초안은 삭제할 수 있고, 게시된 주보에는 삭제 버튼이 없다", async ({ page }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (user.error) throw user.error;
  const draftId = randomUUID(), publishedId = randomUUID();
  try {
    await admin.from("church_editors").insert({ user_id: user.data.user.id });
    await admin.from("bulletins").insert([{ id: draftId, service_date: "2092-11-01", issue_number: 1 }, { id: publishedId, service_date: "2092-11-08", issue_number: 2 }]);
    const items = await admin.from("bulletin_items").insert([
      { bulletin_id: draftId, position: 0, title: "공개 말씀", body: "초안", web_visible: true, needs_review: false },
      { bulletin_id: publishedId, position: 0, title: "공개 말씀", body: "게시", web_visible: true, needs_review: false },
    ]);
    if (items.error) throw items.error;
    const published = await admin.from("bulletins").update({ status: "published" }).eq("id", publishedId);
    if (published.error) throw published.error;

    await page.goto("/admin/bulletins");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();

    await page.getByRole("button", { name: /\(2092-11-08\)/ }).click();
    await expect(page.getByRole("button", { name: "게시 취소", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "주보 목록", exact: true }).first().click();

    await page.getByRole("button", { name: /\(2092-11-01\)/ }).click();
    await dismissConfirm(page);
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    expect((await admin.from("bulletins").select("id").eq("id", draftId)).data).toHaveLength(1);
    await acceptConfirm(page);
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("초안을 삭제했습니다");
    await expect(page.getByRole("button", { name: /\(2092-11-01\)/ })).toHaveCount(0);
    expect((await admin.from("bulletins").select("id").eq("id", draftId)).data).toEqual([]);
    expect((await admin.from("bulletin_items").select("id").eq("bulletin_id", draftId)).data).toEqual([]);
  } finally {
    await admin.from("bulletins").delete().in("id", [draftId, publishedId]);
    await admin.auth.admin.deleteUser(user.data.user.id);
  }
});
