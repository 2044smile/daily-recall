// 매일 1회: 채점 반영 → 새 문장 추가 → 오늘 복습할 카드 표시
import { P, idOf, pageLines, queryAll, createRow, updateRow } from "./notion.js";
import { parseLines, keyOf } from "./parse.js";
import { review, pickToday } from "./scheduler.js";

const dbId = idOf(process.env.REVIEW_DB_ID ?? "");
const sources = (process.env.SOURCE_PAGE_IDS ?? "").split(",").filter(Boolean).map(idOf);
if (!process.env.NOTION_TOKEN || !dbId || !sources.length) {
  throw new Error("NOTION_TOKEN, REVIEW_DB_ID, SOURCE_PAGE_IDS 환경변수가 필요합니다");
}
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST 기준 날짜

const text = (prop) => (prop?.title ?? prop?.rich_text ?? []).map((t) => t.plain_text).join("");

// 1. 기존 카드 읽기 + 채점 반영
const cards = (await queryAll(dbId)).map((row) => {
  const p = row.properties;
  const card = {
    id: row.id,
    en: text(p[P.en]),
    stage: p[P.stage].number ?? 0,
    due: p[P.due].date?.start ?? today,
    lapses: p[P.lapses].number ?? 0,
    today: p[P.today].checkbox,
  };
  const grade = p[P.grade].select?.name;
  return grade ? { ...review(card, grade, today), graded: true, wasToday: card.today } : { ...card, wasToday: card.today };
});

// 2. 학습 페이지에서 새 문장 찾기
const seen = new Set(cards.map((c) => keyOf(c.en)));
let parsed = 0;
for (const pageId of sources) {
  for (const { en, ko } of parseLines(await pageLines(pageId))) {
    parsed++;
    if (seen.has(keyOf(en))) continue;
    seen.add(keyOf(en));
    cards.push({ en, ko, stage: 0, due: today, lapses: 0, isNew: true, wasToday: false });
  }
}

// 3. 오늘 복습 표시 후 바뀐 것만 저장
const picked = new Set(pickToday(cards, today));
const state = (c) => ({
  [P.stage]: { number: c.stage },
  [P.due]: { date: { start: c.due } },
  [P.lapses]: { number: c.lapses },
  [P.today]: { checkbox: picked.has(c) },
  [P.grade]: { select: null },
});
let created = 0, graded = 0;
for (const c of cards) {
  if (c.isNew) {
    await createRow(dbId, {
      [P.ko]: { title: [{ text: { content: c.ko } }] },
      [P.en]: { rich_text: [{ text: { content: c.en } }] },
      [P.added]: { date: { start: today } },
      ...state(c),
    });
    created++;
  } else if (c.graded || c.wasToday !== picked.has(c)) {
    await updateRow(c.id, state(c));
    if (c.graded) graded++;
  }
}

console.log(`[${today}] 파싱 ${parsed}문장, 신규 ${created}, 채점 반영 ${graded}, 오늘 복습 ${picked.size}장`);
if (!parsed) console.warn("학습 페이지에서 문장을 하나도 못 찾았습니다. 통합이 페이지에 연결됐는지, 형식이 맞는지 확인하세요.");
