import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test('scheduled publication stays hidden until publish_at, then becomes public', async () => {
  const url = 'http://127.0.0.1:54321';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, options);
  const editor = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const id = randomUUID(); let userId;
  const hours = n => new Date(Date.now() + n * 3600000).toISOString();
  try {
    const email = `${randomUUID()}@example.test`, password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
    userId = created.data.user.id;
    assert.ifError((await admin.from('church_editors').insert({ user_id: userId })).error);
    assert.ifError((await editor.auth.signInWithPassword({ email, password })).error);
    const items = [{ id: randomUUID(), title: '공개', body: 'public body', webVisible: true, reviewOnCopy: true, needsReview: false }];
    assert.ifError((await editor.rpc('save_bulletin_draft', { p_id: id, p_service_date: '2095-12-03', p_issue_number: 1, p_revision: 0, p_items: items })).error);

    // Too far ahead is rejected.
    assert.equal((await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 1, p_publish: true, p_publish_at: hours(24 * 400) })).error?.message, 'SCHEDULE_TOO_FAR');

    // Future time: committed (published) but invisible to anonymous readers.
    const scheduled = await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 1, p_publish: true, p_publish_at: hours(2) });
    assert.ifError(scheduled.error); assert.equal(scheduled.data.status, 'published'); assert.ok(scheduled.data.publish_at);
    assert.deepEqual((await anon.from('bulletins').select('id').eq('id', id)).data, []);
    assert.deepEqual((await anon.from('bulletin_items').select('id').eq('bulletin_id', id)).data, []);

    // Cancelling returns to a plain draft and clears the schedule.
    const cancelled = await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 2, p_publish: false });
    assert.ifError(cancelled.error); assert.equal(cancelled.data.status, 'draft'); assert.equal(cancelled.data.publish_at, null);

    // A past time means publish now.
    const now = await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 3, p_publish: true, p_publish_at: hours(-1) });
    assert.ifError(now.error); assert.equal(now.data.publish_at, null);
    assert.equal((await anon.from('bulletins').select('id').eq('id', id)).data.length, 1);
    assert.ifError((await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 4, p_publish: false })).error);

    // When the scheduled time passes, the bulletin appears without any further write.
    assert.ifError((await editor.rpc('set_bulletin_publication', { p_id: id, p_revision: 5, p_publish: true, p_publish_at: hours(1) })).error);
    assert.deepEqual((await anon.from('bulletins').select('id').eq('id', id)).data, []);
    assert.ifError((await admin.from('bulletins').update({ publish_at: hours(-0.01) }).eq('id', id)).error);
    assert.equal((await anon.from('bulletins').select('id').eq('id', id)).data.length, 1);
    assert.equal((await anon.from('bulletin_items').select('id').eq('bulletin_id', id)).data.length, 1);

    // Draft rows cannot carry a schedule.
    assert.ok((await admin.from('bulletins').update({ status: 'draft' }).eq('id', id)).error);
  } finally {
    await admin.from('bulletins').delete().eq('id', id);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
