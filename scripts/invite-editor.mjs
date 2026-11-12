import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";

// Run only from a trusted local terminal; no service key or invite token is logged.
const email = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://zefnxczgwpsmfcixonpb.supabase.co" || !secret || !email?.includes("@")) {
  throw new Error("Expected church project, service role key and email argument.");
}
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const invite = await admin.auth.admin.generateLink({ type: "invite", email });
if (invite.error) throw new Error(`Invite failed: ${invite.error.code ?? invite.error.status}`);
const membership = await admin.from("church_editors").upsert({ user_id: invite.data.user.id });
if (membership.error) throw new Error("Invitation created but editor membership failed; rerun after checking permissions.");
const verified = await admin.from("church_editors").select("user_id").eq("user_id", invite.data.user.id).single();
if (verified.error) throw new Error("Editor membership verification failed.");
const link = `http://localhost:3000/admin/account#token_hash=${encodeURIComponent(invite.data.properties.hashed_token)}`;
await mkdir(".local", { recursive: true });
await writeFile(".local/admin-invite.html", `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>관리자 초대</title><h1>관리자 비밀번호 설정</h1><p>먼저 프로젝트에서 npm run dev를 실행하세요.</p><p><a href="${link}">초대 확인 및 비밀번호 설정 열기</a></p><p>이 파일에는 일회용 초대 링크가 있습니다. 공유하지 마세요.</p></html>`, { mode: 0o600 });
console.log("Editor membership verified. Invitation saved to .local/admin-invite.html. No email sent.");
