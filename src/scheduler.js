// 간격 반복: 알아요 → 다음 단계 간격 / 애매 → 내일 다시 / 몰라요 → 처음부터
export const INTERVALS = [1, 3, 7, 16, 35, 90, 180];
export const DAILY_CAP = 30; // 하루 최대 복습 장수

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function review(card, grade, today) {
  if (grade === "몰라요") return { ...card, stage: 0, due: addDays(today, INTERVALS[0]), lapses: card.lapses + 1 };
  if (grade === "애매") return { ...card, due: addDays(today, 1) };
  const stage = Math.min(card.stage + 1, INTERVALS.length - 1);
  return { ...card, stage, due: addDays(today, INTERVALS[stage]) };
}

// 오늘 볼 카드: 기한이 지난 것 중 오래 밀린 것부터 DAILY_CAP장
export const pickToday = (cards, today) =>
  cards
    .filter((c) => c.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, DAILY_CAP);
