import assert from "node:assert/strict";
import test from "node:test";
import {
  createItem, createBulletin, copyBulletin, editItem, confirmItem,
  publicBulletin, printBulletin, offeringPeriod,
} from "../lib/bulletins.ts";

function sample() {
  return {
    ...createBulletin({ id: "old", serviceDate: "2026-10-25", issueNumber: 43 }),
    status: "published",
    items: [
      createItem({ id: "public", title: "교회 소식", body: "환영합니다" }),
      createItem({ id: "private", title: "인쇄용 공지", body: "비공개 본문", webVisible: false }),
    ],
  };
}

test("new items default to public; explicit private remains private", () => {
  assert.equal(createItem({ id: "new", title: "공지" }).webVisible, true);
  assert.equal(sample().items[1].webVisible, false);
});

test("copy preserves both visibility values, creates a draft, and isolates the source", () => {
  const original = sample();
  let sequence = 0;
  const copy = copyBulletin(original,
    { id: "new", serviceDate: "2026-11-01", issueNumber: 44 },
    () => `new-${++sequence}`);
  assert.equal(copy.status, "draft");
  assert.deepEqual(copy.items.map((item) => item.webVisible), [true, false]);
  assert.deepEqual(copy.items.map((item) => item.id), ["new-1", "new-2"]);
  copy.items[1].body = "수정";
  assert.equal(original.items[1].body, "비공개 본문");
  assert.equal(publicBulletin(copy), null);
});

test("editing text retains private visibility; explicit switch can publish or hide", () => {
  const item = sample().items[1];
  const edited = editItem(item, { body: "새 문구" });
  assert.equal(edited.webVisible, false);
  assert.equal(item.body, "비공개 본문");
  assert.equal(editItem(edited, { webVisible: true }).webVisible, true);
  assert.equal(editItem(sample().items[0], { webVisible: false }).webVisible, false);
});

test("public payload excludes private items and their content; print retains them", () => {
  const source = sample();
  const output = publicBulletin(source);
  assert.equal(output.items.length, 1);
  assert.equal(JSON.stringify(output).includes("비공개 본문"), false);
  const print = printBulletin(source);
  assert.equal(print.items.length, 2);
  print.items[0].body = "changed";
  assert.equal(source.items[0].body, "환영합니다");
  source.status = "draft";
  assert.equal(publicBulletin(source), null);
});

test("copy rejects original or duplicate item IDs and nonfuture dates", () => {
  const source = sample();
  const next = { id: "new", serviceDate: "2026-11-01", issueNumber: 44 };
  assert.throws(() => copyBulletin(source, next, () => "private"));
  assert.throws(() => copyBulletin(source, next, () => "same"));
  assert.throws(() => copyBulletin(source, { ...next, id: "old" }, () => "id"));
  assert.throws(() => copyBulletin(source, { ...next, serviceDate: "2026-10-25" }, () => "id"));
});

test("calendar validation rejects malformed and nonexistent dates and invalid issues", () => {
  for (const serviceDate of ["2026-02-30", "2026-13-01", "26-11-1", "not-a-date"]) {
    assert.throws(() => createBulletin({ id: "id", serviceDate, issueNumber: 1 }));
  }
  for (const issueNumber of [0, -1, 1.5, NaN]) {
    assert.throws(() => createBulletin({ id: "id", serviceDate: "2026-11-01", issueNumber }));
  }
});

test("offering summary uses previous month only on first Sunday, including year boundaries", () => {
  assert.equal(offeringPeriod("2026-10-25"), null);
  assert.equal(offeringPeriod("2026-11-01"), "2026-10");
  assert.equal(offeringPeriod("2026-11-08"), null);
  assert.equal(offeringPeriod("2026-12-06"), "2026-11");
  assert.equal(offeringPeriod("2027-01-03"), "2026-12");
  assert.equal(offeringPeriod("2026-11-02"), null);
});

function weeklyCopy() {
  const original = sample();
  original.items.push(createItem({
    id: "sermon", title: "설교 제목", body: "지난주 제목",
    webVisible: false, reviewOnCopy: true,
  }));
  let sequence = 0;
  return copyBulletin(original,
    { id: "copy", serviceDate: "2026-11-01", issueNumber: 44 },
    () => `copy-${++sequence}`);
}

test("weekly copy retains values and flags only weekly items; every new week needs review", () => {
  const copy = weeklyCopy();
  assert.deepEqual(copy.items.map((item) => item.needsReview), [false, false, true]);
  assert.equal(copy.items[2].body, "지난주 제목");
  copy.items[2] = confirmItem(copy.items[2]);
  assert.equal(copy.items[2].needsReview, false);
  let sequence = 0;
  const following = copyBulletin(copy,
    { id: "following", serviceDate: "2026-11-08", issueNumber: 45 },
    () => `following-${++sequence}`);
  assert.equal(following.items[2].needsReview, true);
  assert.equal(copy.items[2].needsReview, false);
});

test("text change or explicit confirmation clears review without exposing a private item", () => {
  const pending = weeklyCopy().items[2];
  for (const reviewed of [editItem(pending, { body: "이번주 제목" }),
    editItem(pending, { title: "이번주 설교" }), confirmItem(pending)]) {
    assert.equal(reviewed.needsReview, false);
    assert.equal(reviewed.webVisible, false);
    assert.equal(reviewed.reviewOnCopy, true);
  }
  assert.equal(pending.needsReview, true);
  assert.equal(confirmItem(pending).body, pending.body);
});

test("autosave of unchanged text and visibility-only changes do not confirm weekly content", () => {
  const pending = weeklyCopy().items[2];
  assert.equal(editItem(pending, {}).needsReview, true);
  assert.equal(editItem(pending, { body: pending.body }).needsReview, true);
  assert.equal(editItem(pending, { webVisible: true }).needsReview, true);
  const copy = weeklyCopy();
  copy.status = "published";
  const response = JSON.stringify(publicBulletin(copy));
  assert.equal(response.includes("needsReview"), false);
  assert.equal(response.includes("reviewOnCopy"), false);
});
