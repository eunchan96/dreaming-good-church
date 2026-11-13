import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
test('community privacy, period, conflict, snapshots and Korea event inclusion',async()=>{
  const url='http://127.0.0.1:54321', options={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(url,process.env.LOCAL_SUPABASE_SERVICE_KEY,options), editor=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,options),anon=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,options),outsider=createClient(url,process.env.LOCAL_SUPABASE_ANON_KEY,options);
  const users=[],entries=[],bulletin=randomUUID(),item=randomUUID();
  try{
    for(const [client,allowed] of [[editor,true],[outsider,false]]){const email=`${randomUUID()}@example.test`,password=randomUUID();const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);users.push(created.data.user.id);if(allowed)assert.ifError((await admin.from('church_editors').insert({user_id:created.data.user.id})).error);assert.ifError((await client.auth.signInWithPassword({email,password})).error);}
    assert.ifError((await editor.rpc('save_bulletin_draft',{p_id:bulletin,p_service_date:'2092-11-02',p_issue_number:1,p_revision:0,p_items:[{id:item,title:'private original',body:'historical body',webVisible:false,reviewOnCopy:false,needsReview:false}]})).error);
    const origin={p_bulletin:bulletin,p_item:item,p_revision:1};
    const exported=await editor.rpc('create_notice_from_bulletin',origin);assert.ifError(exported.error);let notice=exported.data;entries.push(notice.id);
    assert.equal(notice.is_public,false);assert.equal(notice.status,'draft');
    assert.equal((await editor.rpc('create_notice_from_bulletin',origin)).data.id,notice.id);
    assert.deepEqual((await anon.from('community_entries').select('id,title,body').eq('id',notice.id)).data,[]);
    assert.equal((await outsider.rpc('create_notice_from_bulletin',origin)).error?.code,'42501');
    async function save(entry,changes){const result=await editor.rpc('save_community_entry',{p_id:entry.id,p_revision:entry.revision,p_entry:{...entry,...changes}});assert.ifError(result.error);return result.data;}
    notice=await save(notice,{body:'edited notice',is_public:true,status:'published'});
    assert.equal((await anon.from('community_entries').select('body').eq('id',notice.id).single()).data.body,'edited notice');
    assert.equal((await editor.from('bulletin_items').select('body').eq('id',item).single()).data.body,'historical body');
    assert.equal((await editor.rpc('save_community_entry',{p_id:notice.id,p_revision:1,p_entry:notice})).error?.code,'40001');
    assert.equal((await editor.rpc('save_community_entry',{p_id:notice.id,p_revision:notice.revision,p_entry:{...notice,sensitive:true}})).error?.code,'23514');
    notice=await save(notice,{publish_from:'2199-01-01T00:00:00Z'});
    assert.deepEqual((await anon.from('community_entries').select('id').eq('id',notice.id)).data,[]);
    notice=await save(notice,{publish_from:null,publish_until:'2000-01-01T00:00:00Z'});
    assert.deepEqual((await anon.from('community_entries').select('id').eq('id',notice.id)).data,[]);
    notice=await save(notice,{publish_until:null,is_public:false,sensitive:true});
    assert.deepEqual((await anon.from('community_entries').select('id').eq('id',notice.id)).data,[]);
    const eventId=randomUUID();entries.push(eventId);
    let event={id:eventId,kind:'event',title:'event original',body:'event body',location:'교육관',starts_at:'2092-11-01T15:30:00Z',ends_at:null,is_public:false,sensitive:false,publish_from:null,publish_until:null,status:'draft',revision:0};
    event=await save(event,{});
    assert.equal((await editor.rpc('save_community_entry',{p_id:event.id,p_revision:event.revision,p_entry:{...event,ends_at:'2092-11-01T14:00:00Z'}})).error?.code,'23514');
    const copied=await editor.rpc('copy_community_to_bulletin',{p_entry:event.id,p_bulletin:bulletin,p_revision:1});assert.ifError(copied.error);assert.equal(copied.data.revision,2);
    const snapshot=(await editor.from('bulletin_items').select('*').eq('bulletin_id',bulletin).eq('title','event original').single()).data;
    assert.ok(snapshot.body.includes('2092-11-02 00:30'));assert.equal(snapshot.web_visible,false);assert.equal(snapshot.needs_review,true);
    event=await save(event,{is_public:true,status:'published'});
    const publicEvent=await anon.from('community_entries').select('id,starts_at').eq('id',event.id).single();
    assert.ifError(publicEvent.error);assert.equal(new Date(publicEvent.data.starts_at).toISOString(),'2092-11-01T15:30:00.000Z');
    assert.equal((await outsider.rpc('copy_community_to_bulletin',{p_entry:event.id,p_bulletin:bulletin,p_revision:2})).error?.code,'42501');
    event=await save(event,{title:'changed event',status:'archived'});
    assert.equal((await editor.from('bulletin_items').select('title,body').eq('id',snapshot.id).single()).data.title,'event original');
    assert.equal((await editor.rpc('copy_community_to_bulletin',{p_entry:event.id,p_bulletin:bulletin,p_revision:2})).error?.message,'ENTRY_REQUIRED');
    assert.ok((await anon.from('community_entries').select('source_bulletin_id')).error);
    assert.deepEqual((await outsider.from('community_entries').select('*')).data,[]);
  }finally{await admin.from('community_entries').delete().in('id',entries);await admin.from('bulletins').delete().eq('id',bulletin);for(const id of users)await admin.auth.admin.deleteUser(id);}
});
