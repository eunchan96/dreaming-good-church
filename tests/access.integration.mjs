import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test('local access acceptance: metadata cannot grant membership and revocation blocks an existing login', async (t) => {
  const url = 'http://127.0.0.1:54321';
  const key = process.env.LOCAL_SUPABASE_ANON_KEY;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  assert.ok(key && process.env.LOCAL_SUPABASE_SERVICE_KEY, 'Local test keys required');
  const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, options);
  const editor = createClient(url, key, options);
  const outsider = createClient(url, key, options);
  const users = [], bulletin = randomUUID();
  const args = { p_id: bulletin, p_service_date: '2088-11-07', p_issue_number: 1, p_revision: 0,
    p_items: [{ id: randomUUID(), title: '권한 검증용 비공개', body: 'private access marker', webVisible: false, reviewOnCopy: false, needsReview: false }] };
  try {
    for (const client of [editor, outsider]) {
      const email = `${randomUUID()}@example.test`, password = randomUUID();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(created.error); users.push(created.data.user.id);
      if (client === editor) assert.ifError((await admin.from('church_editors').insert({ user_id: created.data.user.id })).error);
      assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    }
    assert.ifError((await editor.rpc('save_bulletin_draft', args)).error);
    await t.test('self-editable admin/editor metadata does not grant private reads or RPC writes', async () => {
      assert.ifError((await outsider.auth.updateUser({ data: { role: 'admin', is_admin: true, editor: true } })).error);
      assert.ifError((await outsider.auth.refreshSession()).error);
      const read = await outsider.from('bulletins').select('id').eq('id', bulletin);
      assert.ifError(read.error); assert.deepEqual(read.data, []);
      assert.equal((await outsider.rpc('save_bulletin_draft', { ...args, p_revision: 1 })).error?.code, '42501');
      assert.ok((await outsider.from('church_editors').insert({ user_id: users[1] })).error);
    });
    await t.test('membership removal denies reads, save, copy and publish without token refresh', async () => {
      const token = (await editor.auth.getSession()).data.session.access_token;
      assert.ifError((await admin.from('church_editors').delete().eq('user_id', users[0])).error);
      assert.equal((await editor.auth.getSession()).data.session.access_token, token);
      for (const table of ['bulletins', 'bulletin_items']) {
        const read = await editor.from(table).select('id').eq(table === 'bulletins' ? 'id' : 'bulletin_id', bulletin);
        assert.ifError(read.error); assert.deepEqual(read.data, []);
      }
      assert.equal((await editor.rpc('save_bulletin_draft', { ...args, p_revision: 1 })).error?.code, '42501');
      assert.equal((await editor.rpc('copy_bulletin_draft', { p_source: bulletin, p_service_date: '2088-11-14', p_issue_number: 2 })).error?.code, '42501');
      assert.equal((await editor.rpc('set_bulletin_publication', { p_id: bulletin, p_revision: 1, p_publish: true })).error?.code, '42501');
      const unchanged = await admin.from('bulletins').select('revision,status').eq('id', bulletin).single();
      assert.ifError(unchanged.error); assert.equal(unchanged.data.revision, 1); assert.equal(unchanged.data.status, 'draft');
    });
  } finally {
    assert.ifError((await admin.from('bulletins').delete().eq('id', bulletin)).error);
    for (const id of users) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
});
