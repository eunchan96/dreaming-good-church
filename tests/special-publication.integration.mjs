import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test('special program publication: editors publish, schedule and withdraw; scheduled ones stay hidden until their time', async () => {
  const url = 'http://127.0.0.1:54321';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, options);
  const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const editor = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const outsider = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const slug = `t-pub-${randomUUID().slice(0, 8)}`, users = [];
  const hours = n => new Date(Date.now() + n * 3600000).toISOString();
  try {
    for (const [client, allowed] of [[editor, true], [outsider, false]]) {
      const email = `${randomUUID()}@example.test`, password = randomUUID();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
      users.push(created.data.user.id);
      if (allowed) assert.ifError((await admin.from('church_editors').insert({ user_id: created.data.user.id })).error);
      assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    }
    assert.ifError((await admin.from('special_programs').insert({ slug, title: '게시 시험', service_date: '2096-05-05', content: { cover: {}, blocks: [] }, pdf_path: `${slug}.pdf` })).error);
    const pdf = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    assert.ifError((await admin.storage.from('special-programs').upload(`${slug}.pdf`, pdf, { contentType: 'application/pdf' })).error);
    const visible = async () => (await anon.from('special_programs').select('slug').eq('slug', slug)).data.length;
    const publish = args => editor.rpc('set_special_program_publication', { p_slug: slug, ...args });

    // Permissions, unknown slug, wrong state, too far ahead.
    assert.ok((await anon.rpc('set_special_program_publication', { p_slug: slug, p_publish: true })).error);
    assert.equal((await outsider.rpc('set_special_program_publication', { p_slug: slug, p_publish: true })).error?.code, '42501');
    assert.equal((await editor.rpc('set_special_program_publication', { p_slug: 'no-such-program', p_publish: true })).error?.code, '22023');
    assert.equal((await publish({ p_publish: false })).error?.message, 'INVALID_PUBLICATION_STATE');
    assert.equal((await publish({ p_publish: true, p_publish_at: hours(24 * 400) })).error?.message, 'SCHEDULE_TOO_FAR');
    assert.equal(await visible(), 0);

    // Scheduled: published but hidden from anonymous readers (row and pdf) until the time.
    const scheduled = await publish({ p_publish: true, p_publish_at: hours(2) });
    assert.ifError(scheduled.error); assert.equal(scheduled.data.status, 'published'); assert.ok(scheduled.data.publish_at);
    assert.equal(await visible(), 0);
    assert.ok((await anon.storage.from('special-programs').download(`${slug}.pdf`)).error);
    assert.equal((await publish({ p_publish: true })).error?.message, 'INVALID_PUBLICATION_STATE');

    // When the time passes it appears without any further write.
    assert.ifError((await admin.from('special_programs').update({ publish_at: hours(-0.01) }).eq('slug', slug)).error);
    assert.equal(await visible(), 1);
    assert.equal((await anon.storage.from('special-programs').download(`${slug}.pdf`)).error, null);

    // Withdrawing returns to a draft and clears the schedule.
    const withdrawn = await publish({ p_publish: false });
    assert.ifError(withdrawn.error); assert.equal(withdrawn.data.status, 'draft'); assert.equal(withdrawn.data.publish_at, null);
    assert.equal(await visible(), 0);

    // A past time means publish now.
    const now = await publish({ p_publish: true, p_publish_at: hours(-1) });
    assert.ifError(now.error); assert.equal(now.data.publish_at, null);
    assert.equal(await visible(), 1);
  } finally {
    await admin.storage.from('special-programs').remove([`${slug}.pdf`]);
    await admin.from('special_programs').delete().eq('slug', slug);
    for (const user of users) await admin.auth.admin.deleteUser(user);
  }
});
