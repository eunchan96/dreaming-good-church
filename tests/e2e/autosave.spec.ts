import {reloadToList} from './bulletin-helpers';
import {saveAndEdit} from './bulletin-helpers';
import {showBulletinVisibility} from './bulletin-helpers';
import {calendarControl,selectCalendar} from './calendar-helpers';
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test("autosave preserves edits, pauses on failure, resumes after login and keeps structured blocks", async ({ page, context }) => {
  const secret = process.env.LOCAL_SUPABASE_SERVICE_KEY;
  if (!secret) throw new Error("Local key required");
  const admin = createClient("http://127.0.0.1:54321", secret, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`, password = `${randomUUID()}-Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  try {
    const member = await admin.from("church_editors").insert({ user_id: id });
    if (member.error) throw member.error;
    async function login() {
      await page.getByLabel("이메일", { exact: true }).fill(email);
      await page.getByLabel("비밀번호", { exact: true }).fill(password);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await expect(page.getByRole("button", { name: "로그아웃",exact:true })).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/bulletins"); await login();
    await page.getByRole("button", { name: "+ 새 주보 작성" }).click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const saveButton = page.getByRole("button", { name: "초안 저장", exact: true });
      expect((await saveButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await selectCalendar(page,calendarControl(page,"예배 날짜"),"2096-11-04");
    await saveAndEdit(page);


    // A slow save must not overwrite typing performed while the request is in flight.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/rpc/save_bulletin_draft", async (route) => { await gate; await route.continue(); }, { times: 1 });
    const started = page.waitForRequest("**/rpc/save_bulletin_draft");
    await page.getByLabel("묵상", { exact: true }).fill("첫 입력");
    await started;
    await page.getByLabel("묵상", { exact: true }).fill("저장 중 추가 입력");
    release();
    await expect.poll(async () => {
      const result = await admin.from("bulletin_items").select("body").eq("title", "묵상 가이드").eq("body", "저장 중 추가 입력");
      return result.data?.length;
    }).toBe(1);

    await page.route("**/rpc/save_bulletin_draft", (route) => route.abort(), { times: 1 });
    await page.getByLabel("묵상", { exact: true }).fill("실패해도 유지");
    await expect(page.getByRole("button", { name: "저장 다시 시도" })).toBeVisible();
    await expect(page.getByLabel("묵상", { exact: true })).toHaveValue("실패해도 유지");
    await saveAndEdit(page,"저장 다시 시도");


    // Signing out in another tab simulates the SDK's session-ended notification.
    const other = await context.newPage(); await other.goto("/admin/bulletins");
    await expect(other.getByRole("button", { name: "로그아웃", exact: true })).toBeVisible();
    await page.getByLabel("묵상", { exact: true }).fill("재로그인 후 이어쓰기");
    await other.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
    await other.close(); await login();
    await expect(page.getByLabel("묵상", { exact: true })).toHaveValue("재로그인 후 이어쓰기");

    await page.route("**/auth/v1/user", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "bad_jwt", message: "JWT expired" }) }), { times: 1 });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
    await login();
    await expect(page.getByLabel("묵상", { exact: true })).toHaveValue("재로그인 후 이어쓰기");

    await page.getByRole("button",{name:"예배 순서 2행 이름 수정",exact:true}).click();await page.getByRole("dialog",{name:"항목 수정",exact:true}).getByLabel("수정 내용",{exact:true}).fill("찬송");await page.getByRole("dialog",{name:"항목 수정",exact:true}).getByRole("button",{name:"적용",exact:true}).click();
    await page.getByLabel("예배 순서 2행 진행 내용", { exact: true }).fill("369장");

    await selectCalendar(page,calendarControl(page,"헌금 집계 월"),"2096-10-01");
    await page.getByRole("button",{name:"헌금 내역 1행 이름 수정",exact:true}).click();await page.getByRole("dialog",{name:"항목 수정",exact:true}).getByLabel("수정 내용",{exact:true}).fill("감사헌금");await page.getByRole("dialog",{name:"항목 수정",exact:true}).getByRole("button",{name:"적용",exact:true}).click();
    await page.getByLabel("헌금 내역 1행 금액", { exact: true }).fill("120000");
    await expect(page.getByText("10월(4주) 총계 120,000원", { exact: true })).toBeVisible();
    await showBulletinVisibility(page);await page.getByLabel("웹에 공개", { exact: true }).last().uncheck();
    await expect.poll(async () => {
      const r = await admin.from("bulletin_items").select("content,web_visible").eq("kind", "offering");
      return r.data?.some((item) => item.content.month === "2096-10" && item.web_visible === false);
    }).toBe(true);
    await reloadToList(page); await page.getByRole("button", { name: /2096-11-04/ }).click();await page.getByRole("button",{name:"수정",exact:true}).click();
    await expect(page.getByLabel("헌금 내역 1행 금액", { exact: true })).toHaveValue("120000");
    await expect(page.getByLabel("예배 순서 2행 진행 내용", { exact: true })).toHaveValue("369장");
    await page.getByRole("button", { name: "웹 미리보기", exact: true }).click();
    await expect(page.getByText("369장", { exact: true })).toBeVisible();
    await expect(page.getByText("감사헌금", { exact: true })).toHaveCount(0);
  } finally {
    await admin.from("bulletins").delete().eq("service_date", "2096-11-04");
    await admin.auth.admin.deleteUser(id);
  }
});
