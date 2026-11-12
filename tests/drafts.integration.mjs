import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Intentionally local-only: never run fixture creation/deletion against a hosted project.
const url = "http://127.0.0.1:54321";
const key = process.env.LOCAL_SUPABASE_ANON_KEY;
const secret = process.env.LOCAL_SUPABASE_SERVICE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

test("local DB: editor save/reopen/copy, atomic rollback, stale save, and access control", async (t) => {
  assert.ok(key && secret, "Provide local keys from supabase status");
  const admin = createClient(url, secret, options);
  const anonymous = createClient(url, key, options);
  const editor = createClient(url, key, options);
  const outsider = createClient(url, key, options);
  const userIds = [];
  const bulletinIds = [];
  try {
    for (const [client, isEditor] of [[editor, true], [outsider, false]]) {
      const email = `${randomUUID()}@example.test`;
      const password = `${randomUUID()}-Aa1!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(created.error);
      userIds.push(created.data.user.id);
      if (isEditor) assert.ifError((await admin.from("church_editors").insert({ user_id: created.data.user.id })).error);
      assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    }
    const source = randomUUID(); bulletinIds.push(source);
    const items = [
      { id: randomUUID(), title: "설교", body: "이전 제목", webVisible: false, reviewOnCopy: true, needsReview: false },
      { id: randomUUID(), title: "공지", body: "환영", webVisible: true, reviewOnCopy: false, needsReview: false },
    ];
    const args = { p_id: source, p_service_date: "2098-11-02", p_issue_number: 43, p_revision: 0, p_items: items };
    await t.test("save and reopen preserve content and visibility", async () => {
      const saved = await editor.rpc("save_bulletin_draft", args); assert.ifError(saved.error);
      assert.equal(saved.data.revision, 1);
      const opened = await editor.from("bulletins").select("*,bulletin_items(*)").eq("id", source).single();
      assert.ifError(opened.error); assert.equal(opened.data.bulletin_items.length, 2);
      assert.equal(opened.data.bulletin_items.find((item) => item.id === items[0].id).web_visible, false);
    });
    let copiedId;
    await t.test("copy creates draft and resets weekly review without exposing private text", async () => {
      const result = await editor.rpc("copy_bulletin_draft", { p_source: source, p_service_date: "2098-11-09", p_issue_number: 44 });
      assert.ifError(result.error); copiedId = result.data.id; bulletinIds.push(copiedId);
      assert.equal(result.data.status, "draft");
      const copied = await editor.from("bulletin_items").select("*").eq("bulletin_id", copiedId).order("position");
      assert.ifError(copied.error);
      assert.equal(copied.data[0].needs_review, true); assert.equal(copied.data[0].web_visible, false);
      assert.equal(copied.data[0].body, "이전 제목"); assert.notEqual(copied.data[0].id, items[0].id);
      assert.equal(copied.data[1].needs_review, false);
    });
    await t.test("confirmed review and edited text survive save and reopen", async () => {
      const current = await editor.from("bulletin_items").select("*").eq("bulletin_id", copiedId).order("position");
      const mapped = current.data.map((item) => ({ id: item.id, title: item.title, body: item.position === 0 ? "이번 주 제목" : item.body,
        webVisible: item.web_visible, reviewOnCopy: item.review_on_copy, needsReview: false }));
      const save = await editor.rpc("save_bulletin_draft", { p_id: copiedId, p_service_date: "2098-11-09", p_issue_number: 44, p_revision: 1, p_items: mapped });
      assert.ifError(save.error); assert.equal(save.data.revision, 2);
      const reopened = await editor.from("bulletin_items").select("*").eq("id", mapped[0].id).single();
      assert.equal(reopened.data.needs_review, false); assert.equal(reopened.data.body, "이번 주 제목");
      const original = await editor.from("bulletin_items").select("body").eq("id", items[0].id).single();
      assert.equal(original.data.body, "이전 제목");
    });
    await t.test("stale revision cannot overwrite a newer save", async () => {
      const saved = await editor.rpc("save_bulletin_draft", { ...args, p_revision: 1 }); assert.ifError(saved.error);
      const stale = await editor.rpc("save_bulletin_draft", { ...args, p_revision: 1 });
      assert.equal(stale.error?.code, "40001");
    });
    await t.test("invalid item rolls back all content and revision changes", async () => {
      const failed = await editor.rpc("save_bulletin_draft", { ...args, p_revision: 2, p_items: [{ ...items[0], title: "" }] });
      assert.ok(failed.error);
      const reopened = await editor.from("bulletins").select("revision,bulletin_items(*)").eq("id", source).single();
      assert.equal(reopened.data.revision, 2); assert.equal(reopened.data.bulletin_items.length, 2);
    });
    await t.test("duplicate date and nonfuture copy are rejected", async () => {
      assert.equal((await editor.rpc("save_bulletin_draft", { ...args, p_id: randomUUID() })).error?.code, "23505");
      assert.equal((await editor.rpc("copy_bulletin_draft", { p_source: source, p_service_date: args.p_service_date, p_issue_number: 44 })).error?.code, "22023");
    });
    await t.test("anonymous and unregistered users cannot read or write drafts", async () => {
      assert.ok((await anonymous.from("bulletins").select("*")).error);
      for (const table of ["bulletins", "bulletin_items"]) {
        const read = await outsider.from(table).select("*"); assert.ifError(read.error); assert.deepEqual(read.data, []);
      }
      assert.equal((await outsider.rpc("save_bulletin_draft", args)).error?.code, "42501");
      assert.ok((await anonymous.rpc("copy_bulletin_draft", { p_source: source, p_service_date: "2098-11-16", p_issue_number: 45 })).error);
      assert.ok((await outsider.from("church_editors").insert({ user_id: userIds[1] })).error);
    });
    await t.test("draft editor cannot publish through a direct database update", async () => {
      const result = await editor.from("bulletins").update({ status: "published" }).eq("id", source);
      assert.ok(result.error);
    });
  } finally {
    if (bulletinIds.length) assert.ifError((await admin.from("bulletins").delete().in("id", bulletinIds)).error);
    for (const id of userIds) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  }
});
