import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test('special programs: anonymous reads only published rows and their pdf; nobody but the service role writes', async () => {
  const url = 'http://127.0.0.1:54321';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, options);
  const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const editor = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  const stamp = randomUUID().slice(0, 8);
  const open = `t-open-${stamp}`, hidden = `t-hidden-${stamp}`;
  const content = { cover: { title: 'test' }, blocks: [] };
  let userId;
  try {
    const email = `${randomUUID()}@example.test`, password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
    userId = created.data.user.id;
    assert.ifError((await admin.from('church_editors').insert({ user_id: userId })).error);
    assert.ifError((await editor.auth.signInWithPassword({ email, password })).error);

    assert.ifError((await admin.from('special_programs').insert([
      { slug: open, title: '공개', service_date: '2096-02-04', status: 'published', content, pdf_path: `${open}.pdf` },
      { slug: hidden, title: '비공개', service_date: '2096-02-11', status: 'draft', content, pdf_path: `${hidden}.pdf` },
    ])).error);
    const pdf = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    assert.ifError((await admin.storage.from('special-programs').upload(`${open}.pdf`, pdf, { contentType: 'application/pdf' })).error);
    assert.ifError((await admin.storage.from('special-programs').upload(`${hidden}.pdf`, pdf, { contentType: 'application/pdf' })).error);

    // Anonymous: only the published row, only public columns, only its pdf.
    const list = await anon.from('special_programs').select('slug,title,service_date').in('slug', [open, hidden]);
    assert.ifError(list.error); assert.deepEqual(list.data.map(row => row.slug), [open]);
    assert.ok((await anon.from('special_programs').select('created_at')).error);
    assert.equal((await anon.storage.from('special-programs').download(`${open}.pdf`)).error, null);
    assert.ok((await anon.storage.from('special-programs').download(`${hidden}.pdf`)).error);

    // Editors can preview drafts but cannot write; anonymous cannot write.
    const seen = await editor.from('special_programs').select('slug').in('slug', [open, hidden]);
    assert.ifError(seen.error); assert.equal(seen.data.length, 2);
    assert.equal((await editor.storage.from('special-programs').download(`${hidden}.pdf`)).error, null);
    assert.ok((await editor.from('special_programs').insert({ slug: `t-x-${stamp}`, title: 'x', service_date: '2096-03-01', content })).error);
    assert.ok((await anon.from('special_programs').insert({ slug: `t-y-${stamp}`, title: 'y', service_date: '2096-03-01', content })).error);
    assert.equal((await editor.from('special_programs').update({ status: 'published' }).eq('slug', hidden).select()).data?.length ?? 0, 0);

    // Bad slugs and oversized pdf names are refused.
    assert.ok((await admin.from('special_programs').insert({ slug: 'Bad Slug', title: 'x', service_date: '2096-03-01', content })).error);
    assert.ok((await admin.from('special_programs').insert({ slug: `t-z-${stamp}`, title: 'x', service_date: '2096-03-01', content, pdf_path: '../x.pdf' })).error);

    // Withdrawing hides the row and its pdf again.
    assert.ifError((await admin.from('special_programs').update({ status: 'draft' }).eq('slug', open)).error);
    assert.deepEqual((await anon.from('special_programs').select('slug').eq('slug', open)).data, []);
    assert.ok((await anon.storage.from('special-programs').download(`${open}.pdf`)).error);
  } finally {
    await admin.storage.from('special-programs').remove([`${open}.pdf`, `${hidden}.pdf`]);
    await admin.from('special_programs').delete().in('slug', [open, hidden]);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
});
