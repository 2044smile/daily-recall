import { test } from "node:test";
import assert from "node:assert/strict";
import { review, pickToday, DAILY_CAP } from "../src/scheduler.js";

const card = { stage: 0, due: "2026-11-10", lapses: 0 };
const today = "2026-11-10";

test("알아요를 이어 누르면 3 → 7 → 16일 간격", () => {
  let c = card, day = today;
  const gaps = [];
  for (let i = 0; i < 3; i++) {
    c = review(c, "알아요", day);
    gaps.push((new Date(c.due) - new Date(day)) / 864e5);
    day = c.due;
  }
  assert.deepEqual(gaps, [3, 7, 16]);
});

test("애매는 단계 유지, 내일 다시", () => {
  const c = review({ ...card, stage: 3 }, "애매", today);
  assert.equal(c.stage, 3);
  assert.equal(c.due, "2026-11-11");
});

test("몰라요는 1단계로 리셋하고 틀린 횟수 증가", () => {
  const c = review({ ...card, stage: 4 }, "몰라요", today);
  assert.deepEqual([c.stage, c.due, c.lapses], [0, "2026-11-11", 1]);
});

test("밀린 카드는 오래된 것부터 하루 상한까지만", () => {
  const cards = Array.from({ length: 50 }, (_, i) => ({ due: `2026-10-${String(i % 28 + 1).padStart(2, "0")}` }));
  cards.push({ due: "2026-12-01" }); // 아직 기한 안 됨
  const picked = pickToday(cards, today);
  assert.equal(picked.length, DAILY_CAP);
  assert.equal(picked[0].due, "2026-10-01");
  assert.ok(picked.every((c) => c.due <= today));
});
