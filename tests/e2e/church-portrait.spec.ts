import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';

test('인사말 사진: upload from 교회 소개, show on the public greeting, protect while used, then remove',async({page,context,request})=>{
 const db=createClient('http://127.0.0.1:54321',process.env.LOCAL_SUPABASE_SERVICE_KEY!,{auth:{persistSession:false}});
 const before=(await db.from('church_portrait').select('*').eq('id',1).single()).data!;
 const email=randomUUID()+'@example.test',password=randomUUID(),user=await db.auth.admin.createUser({email,password,email_confirm:true});if(user.error)throw user.error;
 let imageId='';
 try{
  await db.from('church_editors').insert({user_id:user.data.user.id});
  await page.goto('/admin/bulletins');await page.getByLabel('이메일',{exact:true}).fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page.getByRole('button',{name:'로그아웃',exact:true})).toBeVisible();await page.goto('/admin/church');
  const greeting=page.getByRole('region',{name:'인사말',exact:true});
  await greeting.getByRole('button',{name:'사진 넣기',exact:true}).click();
  const chooser=page.getByRole('dialog',{name:'이미지 추가'});
  const pixels=await sharp({create:{width:600,height:800,channels:3,background:'#7a5c26'}}).png().toBuffer();
  await chooser.getByLabel('올릴 이미지 파일',{exact:true}).setInputFiles({name:'pastor-photo.png',mimeType:'image/png',buffer:pixels});
  await expect(chooser).toBeHidden();
  await expect(greeting.getByLabel('목사님 사진 설명',{exact:true})).toHaveValue('담임목사 사진');
  await greeting.getByLabel('목사님 사진 설명',{exact:true}).fill('담임목사 검증 사진');
  await greeting.getByRole('button',{name:'인사말 저장',exact:true}).click();await expect.poll(async()=>(await db.from('church_portrait').select('alt').eq('id',1).single()).data?.alt).toBe('담임목사 검증 사진');
  const saved=(await db.from('church_portrait').select('*').eq('id',1).single()).data!;expect(saved.image_asset_id).toBeTruthy();expect(saved.alt).toBe('담임목사 검증 사진');expect(saved.revision).toBe(before.revision+1);imageId=saved.image_asset_id!;
  const api=await (await request.get('/api/church-settings')).json();expect(api.portrait).toEqual({imageId,alt:'담임목사 검증 사진'});
  expect((await request.get(`/api/images?id=${imageId}`)).status()).toBe(200);
  const reader=await context.newPage();await reader.goto('/church');await expect(reader.getByRole('img',{name:'담임목사 검증 사진'})).toBeVisible();
  // A photo in use cannot be deleted from the library.
  const token=(await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>/auth-token/.test(k))!;return JSON.parse(localStorage.getItem(key)!).access_token as string;}));
  expect((await request.delete(`/api/images?id=${imageId}`,{headers:{Authorization:`Bearer ${token}`}})).status()).toBe(409);
  await greeting.getByRole('button',{name:'사진 빼기',exact:true}).click();await greeting.getByRole('button',{name:'인사말 저장',exact:true}).click();
  await expect.poll(async()=>(await db.from('church_portrait').select('image_asset_id').eq('id',1).single()).data?.image_asset_id).toBeNull();
  expect((await request.get(`/api/images?id=${imageId}`)).status()).toBe(404);
  await reader.reload();await expect(reader.getByRole('img',{name:'담임목사 검증 사진'})).toHaveCount(0);
 }finally{
  await db.from('church_portrait').update({image_asset_id:before.image_asset_id,alt:before.alt,revision:before.revision}).eq('id',1);
  if(imageId){await db.from('bulletin_images').delete().eq('id',imageId);await db.storage.from('bulletin-images').remove([`${imageId}.webp`]);}
  await db.auth.admin.deleteUser(user.data.user.id);
 }
});
