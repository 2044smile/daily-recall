// 복습 기록: 알아요 → 완료 +1 / 몰라요 → 완료 0으로, 몰라요 +1
// 완료가 GRADUATE회가 되면 뽑기에서 제외. 완료가 적을수록 자주 뽑힘
export const GRADUATE = 5;

export function grade(rec, g, date) {
  if (g === "몰라요") return { ...rec, done: 0, lapses: rec.lapses + 1, last: date };
  return { ...rec, done: rec.done + 1, last: date };
}

export const weight = (done) => 1 / (1 + done);
