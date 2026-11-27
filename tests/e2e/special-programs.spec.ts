import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";

// 특별 순서지: 주보 화면의 바로가기 → 웹 미리보기 → 인쇄 미리보기(PDF). 초안은 어디서도 보이지 않는다. (시험용 가짜 내용만 쓴다)
test("공개된 특별 순서지는 웹·인쇄 미리보기로 보이고, 초안은 보이지 않는다", async ({ page, request }) => {
  const admin = createClient("http://127.0.0.1:54321", process.env.LOCAL_SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const stamp = randomUUID().slice(0, 8), open = `e2e-open-${stamp}`, hidden = `e2e-hidden-${stamp}`;
  const content = {
    cover: { kicker: "시험 교회 10주년", title: "시험 감사예배", date: "2099. 1. 3(주일)", time: "오후 1:00" },
    blocks: [
      { type: "title", text: "시험 감사 예배" },
      { type: "table", title: "대상", tone: "green", rows: [["추대", "가나다, 라마바"]] },
      { type: "band", title: "1부 예배", tone: "olive", lead: "시험 목사" },
      { type: "rows", rows: [{ name: "찬송", what: "595장", who: "다같이" }, { name: "설교", who: "시험 목사", org: "시험교회" }] },
      { type: "band", title: "2부 서약", tone: "gold" },
      { type: "note", parts: [{ heading: "서약자에게", list: ["첫째 서약입니까?", "둘째 서약입니까?"] }, { heading: "교우들에게", text: "**가나다** 씨를 받습니까?" }] },
      { type: "schedule", title: "시험예배 안내", tone: "olive", columns: [[["주일", "오전 10:45"]], [["금요", "저녁 8:45"]]] },
      { type: "boxes", boxes: [{ title: "1층 안내위원", tone: "green", text: "홍길동 집사" }, { title: "5층 안내위원", tone: "green", text: "김철수 집사" }] },
    ],
    notice: { title: "광고", tone: "orange", body: "감사합니다." },
  };
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (user.error) throw user.error;
  const pdf = await PDFDocument.create(); pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  try {
    const member = await admin.from("church_editors").insert({ user_id: user.data.user.id });
    if (member.error) throw member.error;
    const inserted = await admin.from("special_programs").insert([
      { slug: open, title: "시험 감사예배", service_date: "2099-01-03", status: "published", content, pdf_path: `${open}.pdf` },
      { slug: hidden, title: "비공개 시험", service_date: "2099-01-10", status: "draft", content, pdf_path: `${hidden}.pdf` },
    ]);
    if (inserted.error) throw inserted.error;
    for (const name of [open, hidden]) {
      const uploaded = await admin.storage.from("special-programs").upload(`${name}.pdf`, bytes, { contentType: "application/pdf" });
      if (uploaded.error) throw uploaded.error;
    }

    // 주보 화면에는 공개된 것만 바로가기로 보인다.
    await page.goto("/bulletins");
    const links = page.getByRole("navigation", { name: "특별 순서지" });
    await expect(links.getByRole("link", { name: /시험 감사예배/ })).toBeVisible();
    await expect(links.getByRole("link", { name: /비공개 시험/ })).toHaveCount(0);
    await links.getByRole("link", { name: /시험 감사예배/ }).click();

    // 웹 미리보기
    await expect(page.getByRole("heading", { level: 1, name: "시험 감사예배" })).toBeVisible();
    const sheet = page.getByRole("article", { name: "시험 감사예배" });
    await expect(sheet.getByText("1부 예배")).toBeVisible();
    await expect(sheet.getByText("595장")).toBeVisible();
    await expect(sheet.getByText("시험교회")).toBeVisible();
    await expect(sheet.getByText("가나다", { exact: true })).toBeVisible();
    await expect(sheet.getByText("1층 안내위원")).toBeVisible();
    await expect(sheet.getByText("5층 안내위원")).toBeVisible();
    await expect(sheet.getByText("시험예배 안내")).toBeVisible();
    expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex");

    // 인쇄 미리보기(PDF)
    await page.getByRole("button", { name: "인쇄 미리보기" }).click();
    await expect(page.locator("iframe[title$='인쇄용 PDF']")).toHaveAttribute("src", `/api/special-programs/pdf?slug=${open}`);
    await expect(page.getByRole("link", { name: "PDF로 내려받기" })).toHaveAttribute("href", `/api/special-programs/pdf?slug=${open}&download=1`);
    const shown = await request.get(`/api/special-programs/pdf?slug=${open}`);
    expect(shown.status()).toBe(200);
    expect(shown.headers()["content-type"]).toContain("application/pdf");
    expect(shown.headers()["content-disposition"]).toContain("inline");
    expect((await request.get(`/api/special-programs/pdf?slug=${open}&download=1`)).headers()["content-disposition"]).toContain("attachment");
    await page.getByRole("button", { name: "웹 미리보기" }).click();
    await expect(sheet.getByText("1부 예배")).toBeVisible();

    // 초안은 페이지·PDF·목록 어디에도 없다.
    await page.goto(`/bulletins/special/${hidden}`);
    await expect(page.getByText("순서지를 찾을 수 없습니다")).toBeVisible();
    await expect(page.getByText("1부 예배")).toHaveCount(0);
    expect((await request.get(`/api/special-programs/pdf?slug=${hidden}`)).status()).toBe(404);
    const list = await (await request.get("/api/special-programs")).json();
    expect(list.programs.map((program: { slug: string }) => program.slug)).toContain(open);
    expect(list.programs.map((program: { slug: string }) => program.slug)).not.toContain(hidden);
    expect((await request.get("/bulletins/special/Not_A_Slug")).status()).toBe(404);

    // 편집자는 로그인한 상태에서 공개 전 순서지를 웹·인쇄로 미리 볼 수 있다.
    await page.goto("/admin/bulletins");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await page.getByRole("button", { name: /새 주보 작성/ }).waitFor();
    await page.goto(`/bulletins/special/${hidden}`);
    await expect(page.getByText("공개 전 미리보기입니다")).toBeVisible();
    await expect(page.getByRole("article", { name: "비공개 시험" }).getByText("1부 예배")).toBeVisible();
    await page.getByRole("button", { name: "인쇄 미리보기" }).click();
    await expect(page.locator("iframe[title$='인쇄용 PDF']")).toHaveAttribute("src", /^blob:/);
  } finally {
    await admin.storage.from("special-programs").remove([`${open}.pdf`, `${hidden}.pdf`]);
    await admin.from("special_programs").delete().in("slug", [open, hidden]);
    await admin.auth.admin.deleteUser(user.data.user.id);
  }
});
