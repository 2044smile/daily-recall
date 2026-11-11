// 오늘 복습할 문장 고르기: 모든 레슨·섹션 문장을 섞어서 앞에서 n개
export const DAILY_COUNT = 30;
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
