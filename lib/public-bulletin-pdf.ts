import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import type { BlockContent } from "./bulletins";

export type PdfBulletin = {
  service_date: string; issue_number: number;
  items: { title: string; body: string; kind: string; content: unknown }[];
};

// Callers must supply only anonymous, published content and authorized image bytes.
export async function publicBulletinPdf(bulletin: PdfBulletin, image: (id: string) => Promise<Uint8Array>) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Full static font avoids missing composite glyphs in fontkit subsets. Disable
  // contextual glyph substitutions absent from pdf-lib's cmap-based width table.
  const font = await doc.embedFont(await readFile(path.join(process.cwd(), "assets/fonts/NotoSansKR-Regular.ttf")), {
    features: { locl: false, liga: false, calt: false, chws: false, palt: false, halt: false, kern: false },
  });
  doc.setTitle(`${bulletin.service_date} 주일 주보`);
  let page = doc.addPage([595.28, 841.89]), y = 790;
  const left = 45, width = 505;
  function space(height: number) {
    if (y - height >= 48) return;
    if (doc.getPageCount() >= 100) throw new Error("PDF page limit");
    page = doc.addPage([595.28, 841.89]); y = 790;
  }
  const widths = new Map<string, number>();
  function text(value: string, size = 11) {
    // Control characters are not printable. Preserve explicit newlines and tabs as spaces.
    const clean = value.replace(/\t/g, "    ").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
    for (const paragraph of clean.split("\n")) {
      let line = "", used = 0;
      const draw = () => { space(size * 1.65); page.drawText(line, { x: left, y, size, font, color: rgb(.12, .15, .12) }); y -= size * 1.65; };
      for (const char of paragraph) {
        if (!widths.has(char)) widths.set(char, font.widthOfTextAtSize(char, 1));
        const advance = widths.get(char)! * size;
        if (used + advance > width && line) { draw(); line = ""; used = 0; }
        line += char; used += advance;
      }
      draw();
    }
  }
  text("주일 주보", 22);
  text(`${bulletin.service_date} · ${bulletin.issue_number}호`, 12);
  text("웹 공개 항목", 9); y -= 16;
  if (!bulletin.items.length) text("웹에 공개된 주보 항목이 없습니다.");
  for (const item of bulletin.items) {
    space(65); text(item.title || "주보 항목", 15);
    const content = (item.content ?? {}) as BlockContent;
    if (item.kind === "sermon") {
      if (content.reference) text(`성경: ${content.reference}`);
      if (content.preacher) text(`말씀: ${content.preacher}`);
    }
    if (item.body) text(item.body);
    if (item.kind === "worship" || item.kind === "offering") {
      if (content.month) text(content.month);
      for (const row of content.rows ?? []) text(row.join("   |   "));
      if (item.kind === "offering") {
        const total = (content.rows ?? []).reduce((sum, row) => sum + Number(row[1] || 0), 0);
        text(`합계: ${total.toLocaleString("ko-KR")}원`);
      }
    }
    if (item.kind === "image" && content.assetId) {
      const bytes = await image(content.assetId);
      const embedded = await doc.embedPng(await sharp(bytes).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer());
      const scale = Math.min(width / embedded.width, 580 / embedded.height);
      const height = embedded.height * scale;
      space(height + 12); page.drawImage(embedded, { x: left, y: y - height, width: embedded.width * scale, height }); y -= height + 12;
      if (content.alt) text(content.alt, 10);
    }
    y -= 18;
  }
  for (const [index, sheet] of doc.getPages().entries()) sheet.drawText(`${index + 1} / ${doc.getPageCount()}`, { x: left, y: 24, size: 9, font });
  return doc.save();
}
