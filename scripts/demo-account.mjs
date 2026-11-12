import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const url = process.env.DEMO_SUPABASE_URL;
if (url !== 'http://127.0.0.1:54321' || !process.env.DEMO_SERVICE_KEY) throw new Error('This command only supports the local test stack.');
const client = createClient(url, process.env.DEMO_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = 'editor@example.test', password = randomBytes(24).toString('base64url');
let existing;
for(let page=1;;page++) {
  const result = await client.auth.admin.listUsers({page,perPage:100}); if(result.error) throw result.error;
  existing=result.data.users.find(user=>user.email===email);
  if(existing || result.data.users.length<100)break;
}
const result = existing ? await client.auth.admin.updateUserById(existing.id,{password,email_confirm:true}) : await client.auth.admin.createUser({email,password,email_confirm:true});
if(result.error)throw result.error;
const member=await client.from('church_editors').upsert({user_id:result.data.user.id});if(member.error)throw member.error;
const loginCheck=createClient(url,process.env.DEMO_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await loginCheck.auth.signInWithPassword({email,password});if(login.error)throw login.error;
await loginCheck.auth.signOut({scope:'local'});
mkdirSync(new URL('../.local/',import.meta.url),{recursive:true});
writeFileSync(new URL('../.local/demo-account.txt',import.meta.url),`로컬 전용 계정 — 운영 계정과 무관합니다.\n주소: http://localhost:3001/admin/bulletins\n이메일: ${email}\n비밀번호: ${password}\n다시 실행하면 이 로컬 계정의 비밀번호만 변경됩니다.\n`);
console.log('Local demo account ready. Credentials saved in .local/demo-account.txt (not tracked).');
