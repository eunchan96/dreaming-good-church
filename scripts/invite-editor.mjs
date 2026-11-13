import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { accountUrl,accountLinkType,makeAccountLink,escapeHtml } from "../lib/account-links.mjs";

// Run only from a trusted local terminal; no service key or invite token is logged.
const email = process.argv[2];
const options=new Map();
for(let index=3;index<process.argv.length;index+=2) {
  const name=process.argv[index],value=process.argv[index+1];
  if(!['--origin','--type'].includes(name)||!value||options.has(name)) throw new Error('Use EMAIL --origin APPROVED_ORIGIN [--type invite|recovery].');
  options.set(name,value);
}
const origin=options.get('--origin');
if(!origin) throw new Error('An explicit --origin is required; no localhost fallback.');
const redirectTo=accountUrl(origin);
const type=accountLinkType(options.get('--type')??'invite');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://zefnxczgwpsmfcixonpb.supabase.co" || !secret || !email?.includes("@")) {
  throw new Error("Expected church project, service role key and email argument.");
}
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const invite = await admin.auth.admin.generateLink({ type, email, options: {redirectTo} });
if (invite.error) throw new Error(`Invite failed: ${invite.error.code ?? invite.error.status}`);
if(type==='invite') {
  const membership = await admin.from("church_editors").upsert({ user_id: invite.data.user.id });
  if (membership.error) throw new Error("Invitation created but editor membership failed; rerun after checking permissions.");
}
const verified = await admin.from("church_editors").select("user_id").eq("user_id", invite.data.user.id).single();
if (verified.error) throw new Error("Editor membership verification failed.");
const link=makeAccountLink(origin,invite.data.properties.hashed_token,type);
await mkdir(".local", { recursive: true });
const path=`.local/admin-${type}-${randomUUID()}.html`;
await writeFile(path, `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>관리자 계정 설정</title><h1>관리자 비밀번호 설정</h1><p>대상: ${escapeHtml(redirectTo)}</p><p><a href="${escapeHtml(link)}">계정 링크 확인 및 비밀번호 설정 열기</a></p><p>일회용 계정 링크가 들어 있습니다. 공개하거나 업로드하지 마세요.</p></html>`, { flag:'wx',mode: 0o600 });
console.log(`Editor membership verified. Private account link saved to ${path}. No email sent.`);
