import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test('only editors can delete a draft; published bulletins and stale revisions are refused', async () => {
  const url = 'http://127.0.0.1:54321';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, options);
  const editor = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const outsider = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const users = [], id = randomUUID();
  try {
    for (const [client, allowed] of [[editor, true], [outsider, false]]) {
      const email = `${randomUUID()}@example.test`, password = randomUUID();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
      users.push(created.data.user.id);
      if (allowed) assert.ifError((await admin.from('church_editors').insert({ user_id: created.data.user.id })).error);
      assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    }
    const items = [{ id: randomUUID(), title: '공개', body: 'body', webVisible: true, reviewOnCopy: true, needsReview: false }];
    assert.ifError((await editor.rpc('save_bulletin_draft', { p_id: id, p_service_date: '2096-01-07', p_issue_number: 1, p_revision: 0, p_items: items })).error);

    assert.ok((await anon.rpc('delete_bulletin_draft', { p_id: id, p_revision: 1 })).error);
    assert.equal((await outsider.rpc('delete_bulletin_draft', { p_id: id, p_revision: 1 })).error?.code, '42501');
    assert.equal((await editor.rpc('delete_bulletin_draft', { p_id: id, p_revision: 99 })).error?.code, '40001');
    // Direct table deletes stay impossible.
    assert.ok((await editor.from('bulletins').delete().eq('id', id)).error || (await admin.from('bulletins').select('id').eq('id', id)).data.length === 1);

    // A published bulletin must be withdrawn first.
    assert.ifError((await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 1, p_publish: true })).error);
    assert.equal((await editor.rpc('delete_bulletin_draft', { p_id: id, p_revision: 2 })).error?.code, '22023');
    assert.ifError((await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 2, p_publish: false })).error);

    assert.ifError((await editor.rpc('delete_bulletin_draft', { p_id: id, p_revision: 3 })).error);
    assert.deepEqual((await admin.from('bulletins').select('id').eq('id', id)).data, []);
    assert.deepEqual((await admin.from('bulletin_items').select('id').eq('bulletin_id', id)).data, []);
  } finally {
    await admin.from('bulletins').delete().eq('id', id);
    for (const user of users) await admin.auth.admin.deleteUser(user);
  }
});
