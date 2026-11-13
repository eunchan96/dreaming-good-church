import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test("invited editor sets a password and can log in; used invite is rejected", async ({ page }) => {
  const secret = process.env.LOCAL_SUPABASE_SERVICE_KEY;
  if (!secret) throw new Error("Local key required");
  const admin = createClient("http://127.0.0.1:54321", secret, { auth: { persistSession: false } });
  const email = `${randomUUID()}@example.test`;
  const password = `${randomUUID()}-Aa1!`;
  const invite = await admin.auth.admin.generateLink({ type: "invite", email });
  if (invite.error) throw invite.error;
  const id = invite.data.user.id;
  try {
    const member = await admin.from("church_editors").insert({ user_id: id });
    if (member.error) throw member.error;
    const link = `/admin/account#token_hash=${invite.data.properties.hashed_token}`;
    await page.goto(link);
    await page.getByRole("button", { name: "계정 링크 확인", exact: true }).click();
    await page.getByLabel("새 비밀번호", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 확인", { exact: true }).fill("different-password");
    await page.getByRole("button", { name: "비밀번호 설정하고 시작" }).click();
    await expect(page.getByRole("status")).toContainText("두 입력이 같은지");
    await page.getByLabel("비밀번호 확인", { exact: true }).fill(password);
    await page.getByRole("button", { name: "비밀번호 설정하고 시작" }).click();
    await expect(page.getByRole("button", { name: "+ 새 주보 작성" })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByRole("button", { name: "+ 새 주보 작성" })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.goto(link);
    await page.getByRole("button", { name: "계정 링크 확인", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("만료되었거나 이미 사용");
  } finally { await admin.auth.admin.deleteUser(id); }
});

test('recovery link changes an editor password and returns to bulletins; consumed link is rejected',async({page})=>{
  const admin=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
  const email=`${randomUUID()}@example.test`,oldPassword=`${randomUUID()}-Aa1!`,password=`${randomUUID()}-Bb2!`;
  const created=await admin.auth.admin.createUser({email,password:oldPassword,email_confirm:true});
  if(created.error) throw created.error;
  const id=created.data.user.id;
  try {
    const member=await admin.from('church_editors').insert({user_id:id});if(member.error) throw member.error;
    const recovery=await admin.auth.admin.generateLink({type:'recovery',email});if(recovery.error) throw recovery.error;
    const link=`/admin/account#token_hash=${recovery.data.properties.hashed_token}&type=recovery&next=https://attacker.example`;
    await page.goto(link);await page.getByRole('button',{name:'계정 링크 확인',exact:true}).click();
    await page.getByLabel('새 비밀번호',{exact:true}).fill(password);
    await expect(page).toHaveURL(/\/admin\/account$/);
    await page.getByLabel('비밀번호 확인',{exact:true}).fill(password);
    await page.getByRole('button',{name:'비밀번호 설정하고 시작',exact:true}).click();
    await expect(page).toHaveURL(/\/admin\/bulletins$/);
    await expect(page.getByRole('button',{name:'+ 새 주보 작성',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'로그아웃',exact:true}).click();
    await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);
    await page.getByRole('button',{name:'로그인',exact:true}).click();
    await expect(page.getByRole('button',{name:'+ 새 주보 작성',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'로그아웃',exact:true}).click();
    await page.goto(link);await page.getByRole('button',{name:'계정 링크 확인',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('만료되었거나 이미 사용');
  } finally {await admin.auth.admin.deleteUser(id);}
});

test('membership revoked after link verification cannot change the password',async({page})=>{
  const admin=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
  const email=`${randomUUID()}@example.test`,password=`${randomUUID()}-Aa1!`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error) throw created.error;
  const id=created.data.user.id;
  try {
    const member=await admin.from('church_editors').insert({user_id:id});if(member.error) throw member.error;
    const recovery=await admin.auth.admin.generateLink({type:'recovery',email});if(recovery.error) throw recovery.error;
    await page.goto(`/admin/account#token_hash=${recovery.data.properties.hashed_token}&type=recovery`);
    await page.getByRole('button',{name:'계정 링크 확인',exact:true}).click();
    await page.getByLabel('새 비밀번호',{exact:true}).fill(`${randomUUID()}-Bb2!`);
    const revoked=await admin.from('church_editors').delete().eq('user_id',id);if(revoked.error) throw revoked.error;
    await page.getByLabel('비밀번호 확인',{exact:true}).fill(await page.getByLabel('새 비밀번호',{exact:true}).inputValue());
    await page.getByRole('button',{name:'비밀번호 설정하고 시작',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('편집 권한을 확인하지 못했습니다');
    const probe=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
    const unchanged=await probe.auth.signInWithPassword({email,password});expect(unchanged.error).toBeNull();
  } finally {await admin.auth.admin.deleteUser(id);}
});

test('signing out in another tab clears the verified password form',async({page,context})=>{
  const admin=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
  const email=`${randomUUID()}@example.test`;
  const invite=await admin.auth.admin.generateLink({type:'invite',email});if(invite.error) throw invite.error;
  const id=invite.data.user.id;
  try {
    const member=await admin.from('church_editors').insert({user_id:id});if(member.error) throw member.error;
    await page.goto(`/admin/account#token_hash=${invite.data.properties.hashed_token}`);
    await page.getByRole('button',{name:'계정 링크 확인',exact:true}).click();
    await page.getByLabel('새 비밀번호',{exact:true}).fill(`${randomUUID()}-Aa1!`);
    const other=await context.newPage();await other.goto('/admin/bulletins');
    await other.getByRole('button',{name:'로그아웃',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('세션이 만료');
    await expect(page.getByLabel('새 비밀번호',{exact:true})).toHaveCount(0);
  } finally {await admin.auth.admin.deleteUser(id);}
});
