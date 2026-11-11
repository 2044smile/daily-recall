import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, weight, GRADUATE } from "../src/record.js";

const rec = { done: 3, lapses: 1, last: null };

test("알아요는 완료 +1", () => {
  assert.deepEqual(grade(rec, "알아요", "2026-11-12"), { done: 4, lapses: 1, last: "2026-11-12" });
});

test("몰라요는 완료를 0으로 되돌리고 몰라요 +1", () => {
  assert.deepEqual(grade(rec, "몰라요", "2026-11-12"), { done: 0, lapses: 2, last: "2026-11-12" });
});

test("완료가 적을수록 가중치가 크다", () => {
  assert.ok(weight(0) > weight(1) && weight(1) > weight(GRADUATE - 1));
});
