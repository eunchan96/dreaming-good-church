import { readFile } from "node:fs/promises";
import path from "node:path";
import subsetFont from "subset-font";
import { noStore, requireEditor } from "@/lib/server-access";

/*
 * Word 주보에 넣을 글꼴: 미리보기와 같은 Noto Sans KR을 주보에 쓰인 글자만 잘라(subset) 보낸다.
 * 굵기 400(Regular)·600(SemiBold)·700(Bold). 원본은 assets/fonts/word(한글·영문·기호 범위로 미리 줄인 OFL 글꼴).
 */
const FACES = { regular: "NotoSansKR-Regular.ttf", semibold: "NotoSansKR-SemiBold.ttf", bold: "NotoSansKR-Bold.ttf" } as const;
const MAX_TEXT = 20000;
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

export async function POST(request: Request) {
  try {
    if (!await requireEditor(request)) return reply("관리자 로그인이 필요합니다.", 401);
    const body = await request.json().catch(() => null) as { text?: unknown } | null;
    if (typeof body?.text !== "string" || !body.text.trim()) return reply("글자를 보내 주세요.", 400);
    // 같은 글자는 한 번만: 주보 한 부는 보통 수백 자.
    const text = [...new Set(body.text)].join("").slice(0, MAX_TEXT);
    const fonts = Object.fromEntries(await Promise.all(Object.entries(FACES).map(async ([key, file]) => {
      const source = await readFile(path.join(process.cwd(), "assets/fonts/word", file));
      const subset = await subsetFont(source, text, { targetFormat: "truetype" });
      return [key, Buffer.from(subset).toString("base64")] as const;
    })));
    return Response.json(fonts, { headers: noStore });
  } catch { return reply("글꼴을 준비하지 못했습니다.", 503); }
}
