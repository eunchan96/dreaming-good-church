import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createItem } from '../lib/bulletins.ts';

test('mixed visibility copy, private edit, default-public addition and publish form one isolated flow', async () => {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const url = 'http://127.0.0.1:54321';
  const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, options);
  const editor = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const source = randomUUID(), bulletins = [source]; let user;
  try {
    const email = `${randomUUID()}@example.test`, password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error); user = created.data.user.id;
    assert.ifError((await admin.from('church_editors').insert({ user_id: user })).error);
    assert.ifError((await editor.auth.signInWithPassword({ email, password })).error);
    const items = [createItem({ id: randomUUID(), title: '공개 원본', body: 'public original' }),
      createItem({ id: randomUUID(), title: 'private title marker', body: 'private original', webVisible: false, reviewOnCopy: true })];
    assert.ifError((await editor.rpc('save_bulletin_draft', { p_id: source, p_service_date: '2087-11-02', p_issue_number: 1, p_revision: 0, p_items: items })).error);
    assert.ifError((await editor.rpc('set_bulletin_publication', { p_id: source, p_revision: 1, p_publish: true })).error);
    const copy = await editor.rpc('copy_bulletin_draft', { p_source: source, p_service_date: '2087-11-09', p_issue_number: 2 });
    assert.ifError(copy.error); bulletins.push(copy.data.id); assert.equal(copy.data.status, 'draft');
    const read = await editor.from('bulletin_items').select('*').eq('bulletin_id', copy.data.id).order('position');
    assert.ifError(read.error); assert.deepEqual(read.data.map(i => i.web_visible), [true, false]);
    assert.deepEqual(read.data.map(i => i.needs_review), [false, true]);
    assert.ok(read.data.every(i => !items.some(original => original.id === i.id)));
    const edited = read.data.map(i => ({ id: i.id, title: i.title, body: i.web_visible ? i.body : 'private edited marker',
      webVisible: i.web_visible, reviewOnCopy: i.review_on_copy, needsReview: false, kind: i.kind, content: i.content }));
    const added = createItem({ id: randomUUID(), title: '새 공지', body: 'new public marker' });
    assert.equal(added.webVisible, true); edited.push(added);
    assert.ifError((await editor.rpc('save_bulletin_draft', { p_id: copy.data.id, p_service_date: '2087-11-09', p_issue_number: 2, p_revision: 1, p_items: edited })).error);
    const reopened = await editor.from('bulletin_items').select('body,web_visible').eq('bulletin_id', copy.data.id).order('position');
    assert.ifError(reopened.error); assert.deepEqual(reopened.data.map(i => i.web_visible), [true, false, true]);
    assert.equal(reopened.data[1].body, 'private edited marker');
    assert.ifError((await editor.rpc('set_bulletin_publication', { p_id: copy.data.id, p_revision: 2, p_publish: true })).error);
    const publicRead = await anon.from('bulletins').select('id,items:bulletin_items(title,body,kind,content)').eq('id', copy.data.id).single();
    assert.ifError(publicRead.error); assert.equal(publicRead.data.items.length, 2);
    assert.ok(JSON.stringify(publicRead.data).includes('new public marker'));
    assert.ok(!JSON.stringify(publicRead.data).includes('private'));
    const original = await editor.from('bulletin_items').select('body,web_visible').eq('id', items[1].id).single();
    assert.ifError(original.error); assert.deepEqual(original.data, { body: 'private original', web_visible: false });
  } finally {
    assert.ifError((await admin.from('bulletins').delete().in('id', bulletins)).error);
    if (user) assert.ifError((await admin.auth.admin.deleteUser(user)).error);
  }
});
