import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test('publication checks review and revision; anonymous reads exclude drafts and hidden payloads', async () => {
  const url = 'http://127.0.0.1:54321';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, options);
  const editor = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const outsider = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const users = [], id = randomUUID(), copies = [];
  try {
    for (const [client, allowed] of [[editor,true],[outsider,false]]) {
      const email = `${randomUUID()}@example.test`, password = randomUUID();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm:true }); assert.ifError(created.error);
      users.push(created.data.user.id);
      if (allowed) assert.ifError((await admin.from('church_editors').insert({user_id:created.data.user.id})).error);
      assert.ifError((await client.auth.signInWithPassword({email,password})).error);
    }
    const items = [{id:randomUUID(),title:'공개',body:'public body',webVisible:true,reviewOnCopy:true,needsReview:true},
      {id:randomUUID(),title:'private marker',body:'private body marker',webVisible:false,reviewOnCopy:false,needsReview:false}];
    const args = {p_id:id,p_service_date:'2095-11-06',p_issue_number:1,p_revision:0,p_items:items};
    assert.ifError((await editor.rpc('save_bulletin_draft',args)).error);
    assert.deepEqual((await anon.from('bulletins').select('id').eq('id',id)).data, []);
    const publish = {p_id:id,p_revision:1,p_publish:true};
    assert.ok((await anon.rpc('set_bulletin_publication',publish)).error);
    assert.equal((await outsider.rpc('set_bulletin_publication',publish)).error?.code,'42501');
    assert.equal((await editor.rpc('set_bulletin_publication',publish)).error?.message,'REVIEW_REQUIRED');
    items[0].needsReview=false;
    assert.ifError((await editor.rpc('save_bulletin_draft',{...args,p_revision:1})).error);
    assert.equal((await editor.rpc('set_bulletin_publication',publish)).error?.code,'40001');
    const published = await editor.rpc('set_bulletin_publication',{...publish,p_revision:2}); assert.ifError(published.error);
    assert.equal(published.data.revision,3);
    const notice = await editor.rpc('create_notice_from_bulletin',{p_bulletin:id,p_item:items[1].id,p_revision:3});
    assert.ifError(notice.error);
    assert.equal(notice.data.is_public,false);
    const copy = await editor.rpc('copy_bulletin_draft',{p_source:id,p_service_date:'2095-11-13',p_issue_number:2});
    assert.ifError(copy.error);copies.push(copy.data.id);
    assert.equal(copy.data.status,'draft');
    assert.equal((await editor.from('bulletin_items').select('id').eq('bulletin_id',copy.data.id)).data.length,2);
    const visible = await anon.from('bulletins').select('id,items:bulletin_items(id,title,body,kind,content)').eq('id',id).single();
    assert.ifError(visible.error); assert.equal(visible.data.items.length,1);
    assert.ok(!JSON.stringify(visible.data).includes('private'));
    assert.ok((await anon.from('bulletin_items').select('needs_review')).error);
    assert.deepEqual((await anon.from('bulletin_items').select('id,title,body').eq('id',items[1].id)).data,[]);
    assert.ok((await editor.rpc('save_bulletin_draft',{...args,p_revision:3})).error);
    assert.equal((await editor.from('bulletin_items').update({body:'illegal'}).eq('id',items[0].id).select()).data?.length,0);
    assert.ifError((await editor.rpc('set_bulletin_publication',{p_id:id,p_revision:3,p_publish:false})).error);
    assert.deepEqual((await anon.from('bulletins').select('id').eq('id',id)).data,[]);
    assert.deepEqual((await anon.from('bulletin_items').select('id').eq('bulletin_id',id)).data,[]);
    items[0].webVisible=false;
    assert.ifError((await editor.rpc('save_bulletin_draft',{...args,p_revision:4})).error);
    assert.equal((await editor.rpc('set_bulletin_publication',{p_id:id,p_revision:5,p_publish:true})).error?.message,'PUBLIC_CONTENT_REQUIRED');
  } finally {
    await admin.from('community_entries').delete().eq('source_bulletin_id',id);
    await admin.from('bulletins').delete().in('id',[id,...copies]);
    for (const user of users) await admin.auth.admin.deleteUser(user);
  }
});
