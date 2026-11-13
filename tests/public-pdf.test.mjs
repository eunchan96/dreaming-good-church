import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { publicBulletinPdf } from "../lib/public-bulletin-pdf.ts";

test("public PDF paginates long Korean text on A4 without truncating pages", async () => {
  const bytes = await publicBulletinPdf({ service_date: "2026-11-01", issue_number: 44, items: [
    { title: "교회 소식", body: "함께 예배하고 서로 사랑하며 기도하는 교회입니다. ".repeat(200), kind: "text", content: {} },
  ] }, async () => { throw new Error("Text must not request images"); });
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() > 1);
  assert.equal(doc.getTitle(), "2026-11-01 주일 주보");
  for (const page of doc.getPages()) { assert.equal(page.getWidth(), 595.28); assert.equal(page.getHeight(), 841.89); }
});

test("public PDF fails when a referenced image cannot be loaded", async () => {
  await assert.rejects(publicBulletinPdf({ service_date: "2026-11-01", issue_number: 44, items: [
    { title: "표지", body: "", kind: "image", content: { assetId: "missing" } },
  ] }, async () => { throw new Error("Image unavailable"); }), /Image unavailable/);
});
