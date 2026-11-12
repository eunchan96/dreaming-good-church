import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
test('church info atomic updates and image privacy, immutable storage, historical reference protection',async()=>{
 const url='http://127.0.0.1:54321',options={auth:{persistSession:false,autoRefreshToken:false}};
 const admin=createClient(url,process.env.LOCAL_SUPABASE_SERVICE_KEY,options),anon=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,options),editor=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,options),outsider=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,options);
 const users=[],image=randomUUID(),bulletin=randomUUID(),item=randomUUID();let copied;
 const original=await admin.from('church_info').select('*');assert.ifError(original.error);
 try{
  for(const client of [editor,outsider]) { const email=`${randomUUID()}@example.test`,password=randomUUID();const user=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(user.error);users.push(user.data.user.id);if(client===editor)assert.ifError((await admin.from('church_editors').insert({user_id:user.data.user.id})).error);assert.ifError((await client.auth.signInWithPassword({email,password})).error); }
  const fields=original.data.map(f=>({...f,body:f.key==='phone'?'private phone':'public '+f.key,web_visible:f.key!=='phone'}));
  assert.equal((await outsider.rpc('save_church_info',{p_fields:fields})).error?.code,'42501');
  assert.ifError((await editor.rpc('save_church_info',{p_fields:fields})).error);
  assert.equal((await editor.rpc('save_church_info',{p_fields:fields})).error?.code,'40001');
  const publicFields=await anon.from('church_info').select('key,body');assert.ifError(publicFields.error);assert.equal(publicFields.data.length,5);assert.ok(!JSON.stringify(publicFields.data).includes('private phone'));
  assert.ok((await anon.from('church_info').select('revision')).error);assert.ok((await editor.from('church_info').delete().eq('key','name')).error);
  const pixels=await sharp({create:{width:10,height:10,channels:3,background:'white'}}).webp().toBuffer();
  assert.ifError((await admin.storage.from('bulletin-images').upload(`${image}.webp`,pixels,{contentType:'image/webp'})).error);
  assert.ifError((await admin.from('bulletin_images').insert({id:image,title:'test',alt:'image description',width:10,height:10,bytes:pixels.length})).error);
  assert.ok((await editor.storage.from('bulletin-images').upload(`${randomUUID()}.webp`,pixels,{contentType:'image/webp'})).error);
  assert.ok((await editor.storage.from('bulletin-images').update(`${image}.webp`,pixels,{contentType:'image/webp'})).error);
  assert.ok((await anon.storage.from('bulletin-images').download(`${image}.webp`)).error);
  assert.ifError((await editor.storage.from('bulletin-images').download(`${image}.webp`)).error);
  assert.ok((await outsider.storage.from('bulletin-images').download(`${image}.webp`)).error);
  const entry={id:item,title:'image',body:'',kind:'image',content:{assetId:image,alt:'snapshot description'},webVisible:true,reviewOnCopy:false,needsReview:false};
  assert.ifError((await editor.rpc('save_bulletin_draft',{p_id:bulletin,p_service_date:'2090-11-05',p_issue_number:1,p_revision:0,p_items:[entry]})).error);
  assert.ok((await anon.storage.from('bulletin-images').download(`${image}.webp`)).error);
  assert.equal((await admin.from('bulletin_images').delete().eq('id',image)).error?.code,'23503');
  assert.ifError((await editor.rpc('set_bulletin_publication',{p_id:bulletin,p_revision:1,p_publish:true})).error);
  assert.ifError((await anon.storage.from('bulletin-images').download(`${image}.webp`)).error);
  const copy=await editor.rpc('copy_bulletin_draft',{p_source:bulletin,p_service_date:'2090-11-12',p_issue_number:2});assert.ifError(copy.error);copied=copy.data.id;
  assert.ifError((await editor.rpc('set_bulletin_publication',{p_id:bulletin,p_revision:2,p_publish:false})).error);
  assert.ok((await anon.storage.from('bulletin-images').download(`${image}.webp`)).error);
  assert.ifError((await editor.rpc('save_bulletin_draft',{p_id:bulletin,p_service_date:'2090-11-05',p_issue_number:1,p_revision:3,p_items:[{...entry,webVisible:false},{id:randomUUID(),title:'public',body:'public text',webVisible:true,reviewOnCopy:false,needsReview:false}]})).error);
  assert.ifError((await editor.rpc('set_bulletin_publication',{p_id:bulletin,p_revision:4,p_publish:true})).error);
  assert.ok((await anon.storage.from('bulletin-images').download(`${image}.webp`)).error);
  assert.ifError((await editor.rpc('set_bulletin_publication',{p_id:bulletin,p_revision:5,p_publish:false})).error);
  assert.ifError((await editor.rpc('save_bulletin_draft',{p_id:bulletin,p_service_date:'2090-11-05',p_issue_number:1,p_revision:6,p_items:[]})).error);
  assert.equal((await admin.from('bulletin_images').delete().eq('id',image)).error?.code,'23503');
  assert.equal((await editor.from('bulletin_items').select('content').eq('bulletin_id',copied).single()).data.content.alt,'snapshot description');
 }finally{
  await admin.from('bulletins').delete().in('id',[bulletin,...(copied?[copied]:[])]);
  await admin.from('bulletin_images').delete().eq('id',image);await admin.storage.from('bulletin-images').remove([`${image}.webp`]);
  for(const field of original.data)await admin.from('church_info').update(field).eq('key',field.key);
  for(const id of users)await admin.auth.admin.deleteUser(id);
 }
});
