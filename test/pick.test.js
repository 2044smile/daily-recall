import { test } from "node:test";
import assert from "node:assert/strict";
import { pick, weightedPick, DAILY_COUNT } from "../src/pick.js";

const items = Array.from({ length: 100 }, (_, i) => i);

test("겹치지 않게 하루 분량만큼 고른다", () => {
  const picked = pick(items);
  assert.equal(picked.length, DAILY_COUNT);
  assert.equal(new Set(picked).size, DAILY_COUNT);
  assert.ok(picked.every((x) => items.includes(x)));
});

test("문장이 분량보다 적으면 전부 섞어서 낸다", () => {
  assert.deepEqual(pick([1, 2, 3]).sort(), [1, 2, 3]);
});

test("순서를 섞는다", () => {
  assert.notDeepEqual(pick(items, 100), items);
});

test("가중치가 큰 쪽이 더 자주 뽑힌다", () => {
  const items = [...Array.from({ length: 50 }, () => ({ w: 1 })), ...Array.from({ length: 50 }, () => ({ w: 1 / 6 }))];
  let heavy = 0;
  for (let i = 0; i < 200; i++) heavy += weightedPick(items, 30, (x) => x.w).filter((x) => x.w === 1).length;
  assert.ok(heavy / 200 > 20, `무거운 쪽 평균 ${heavy / 200}개`);
});
