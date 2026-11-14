// 오늘 복습할 문장 고르기
// 하루 문장 수. 환경변수 DAILY_COUNT로 조절 (기본 10)
export const DAILY_COUNT = Number(process.env.DAILY_COUNT || 10);
if (!Number.isInteger(DAILY_COUNT) || DAILY_COUNT < 1) {
  throw new Error(`DAILY_COUNT는 1 이상의 정수여야 합니다: ${process.env.DAILY_COUNT}`);
}
export const FLASH_COUNT = 5; // 문법 포인트(플래시 카드) 장수

export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (items, n = DAILY_COUNT, random = Math.random) => shuffle(items, random).slice(0, n);

// 가중치 비례 무작위 n개 (Efraimidis–Spirakis): 가중치가 클수록 뽑힐 확률이 큼
export const weightedPick = (items, n, weightOf, random = Math.random) =>
  shuffle(
    items
      .map((x) => ({ x, k: random() ** (1 / weightOf(x)) }))
      .sort((a, b) => b.k - a.k)
      .slice(0, n)
      .map((e) => e.x),
    random,
  );
