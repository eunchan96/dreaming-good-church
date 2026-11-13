import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
test('three-week seed has public history, private print content, reviewed draft and fictional community data', async()=>{
 const options={auth:{persistSession:false,autoRefreshToken:false}},url='http://127.0.0.1:54321';
 const admin=createClient(url,process.env.LOCAL_SUPABASE_SERVICE_KEY,options),anon=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,options);
 const ids=[1,2,3].map(n=>`d0000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
 const all=await admin.from('bulletins').select('id,status,service_date,bulletin_items(*)').in('id',ids).order('service_date');assert.ifError(all.error);
 assert.deepEqual(all.data.map(row=>row.service_date),['2026-11-01','2026-11-08','2026-11-15']);
 assert.deepEqual(all.data.map(row=>row.status),['published','published','draft']);
 assert.equal(all.data.flatMap(row=>row.bulletin_items).length,13);
 assert.equal(all.data[2].bulletin_items.filter(item=>item.needs_review).length,2);
 for(const row of all.data){assert.equal(row.bulletin_items.filter(item=>!item.web_visible).length,1);assert.ok(row.bulletin_items.every(item=>item.title.startsWith('[샘플]')));}
 const publicRows=await anon.from('bulletins').select('id,bulletin_items(id,title,body,kind,content)').in('id',ids);assert.ifError(publicRows.error);assert.equal(publicRows.data.length,2);
 assert.ok(!JSON.stringify(publicRows.data).includes('인쇄 전용'));
 const offerings=publicRows.data.flatMap(row=>row.bulletin_items).filter(item=>item.kind==='offering');assert.equal(offerings[0].content.month,'2026-10');
 const entries=await admin.from('community_entries').select('*').like('title','[샘플]%');assert.ifError(entries.error);assert.equal(entries.data.length,5);
 const publicEntries=await anon.from('community_entries').select('title,starts_at');assert.ifError(publicEntries.error);
 const samples=publicEntries.data.filter(row=>row.title.startsWith('[샘플]'));assert.equal(samples.length,3);assert.ok(!JSON.stringify(samples).includes('내부 준비'));
 assert.ok(samples.some(row=>row.starts_at && new Date(row.starts_at).toISOString()==='2026-11-01T04:40:00.000Z'));
 const info=await anon.from('church_info').select('key,body');assert.ifError(info.error);assert.equal(info.data.length,6);assert.ok(info.data.every(row=>row.body.startsWith('[샘플]')));
});
