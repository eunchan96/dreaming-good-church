import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { acceptConfirm, dismissConfirm } from "./confirm";

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
    expect((await reader.request.get("/api/bulletins/pdf?date=2094-11-07")).status()).toBe(404);
    expect((await reader.request.get("/api/bulletins/pdf?date=2094-02-31")).status()).toBe(400);
    await page.goto("/admin/bulletins");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await page.getByRole("button", { name: /2094-11-07/ }).click();await page.getByRole("button",{name:"수정",exact:true}).click();
    expect((await page.request.get("/api/bulletins/pdf?date=2094-11-07")).status()).toBe(404);
    await acceptConfirm(page);
    await page.getByRole("button", { name: "게시하기", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("주보를 게시했습니다");
    await expect(page.getByRole("heading", { name: "주보 목록", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /\(2094-11-07\)/ }).click();
    await expect(page.getByRole("button", { name: "게시 취소", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox",{name:"공개 말씀 내용",exact:true})).toHaveCount(0);
    const response = await reader.request.get(`/api/bulletins?id=${id}`);
    expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toContain("no-store");
    const payload = await response.text();
    expect(payload).not.toContain("printPage");
    expect(payload).toContain("성도에게 보여줄 내용");
    expect(payload).not.toContain("노출되면"); expect(payload).not.toContain("숨겨진"); expect(payload).not.toContain("needs_review");
    expect((await reader.request.get("/api/bulletins?date=2094-11-07")).status()).toBe(200);
    const shareHtml = await (await reader.request.get("/bulletins/2094-11-07")).text();
    expect(shareHtml).toContain('property="og:title" content="2094-11-07 · 1호 주보 | 꿈꾸는좋은교회"');
    expect(shareHtml).not.toContain("숨겨진 제목");
    await reader.goto("/bulletins/2094-11-07");
    await expect(reader.getByText("성도에게 보여줄 내용", { exact: true })).toBeVisible();
    // 화면의 PDF 버튼은 인쇄 미리보기와 같은 시트로 인쇄(PDF로 저장) 창을 연다.
    await reader.evaluate(() => { (window as unknown as { __printed: number }).__printed = 0; window.print = () => { (window as unknown as { __printed: number }).__printed++; }; });
    await reader.getByRole("button", { name: "PDF로 내려받기", exact: true }).click();
    await expect.poll(() => reader.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    const pdf = await reader.request.get("/api/bulletins/pdf?date=2094-11-07");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["cache-control"]).toContain("no-store");
    const bytes = await pdf.body();
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    await mkdir(".local", { recursive: true });
    await writeFile(".local/public-bulletin.pdf", bytes);
    await reader.goto("/bulletins");
    await reader.getByRole("button", { name: "지난 주보", exact: true }).click();
    await reader.getByRole("region", { name: "지난 주보" }).getByRole("button", { name: /^2094년 11월 7일 .* · 1호$/ }).click();
    await expect(reader.getByText("성도에게 보여줄 내용", { exact: true })).toBeVisible();
    await expect(reader.getByText("숨겨진 제목", { exact: true })).toHaveCount(0);
    await acceptConfirm(page);
    await page.getByRole("button", { name: "게시 취소", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("게시를 취소했습니다");
    expect((await reader.request.get(`/api/bulletins?id=${id}`)).status()).toBe(404);
    expect((await reader.request.get("/api/bulletins?date=2094-11-07")).status()).toBe(404);
    expect((await reader.request.get("/api/bulletins/pdf?date=2094-11-07")).status()).toBe(404);
    const withdrawnHtml = await (await reader.request.get("/bulletins/2094-11-07")).text();
    // 게시를 취소한 주보는 주보 제목을 공유 정보에 남기지 않고(사이트 기본 정보만) 검색에서도 뺀다.
    expect(withdrawnHtml).not.toContain('1호 주보');
    expect(withdrawnHtml).toContain('<meta name="robots" content="noindex, nofollow"/>');
    await reader.goto("/bulletins/2094-11-07");
    await expect(reader.getByText("성도에게 보여줄 내용", { exact: true })).toHaveCount(0);
  } finally {
    await readerContext.close();
    await admin.from("bulletins").delete().eq("id", id);
    await admin.auth.admin.deleteUser(user.data.user.id);
  }
});
