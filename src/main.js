// 매일 1회: 지난 복습 체크 반영 → 학습 페이지 전체에서 문장을 모아 고른 뒤 '오늘의 복습' 페이지를 만듦
import {
  idOf, plain, children, collect, archivePage, renamePage, createPage,
  L, ensureLog, queryAll, createRow, updateRow, readGrades,
} from "./notion.js";
import { parseLines, keyOf } from "./parse.js";
import { pick, weightedPick, DAILY_COUNT, FLASH_COUNT } from "./pick.js";
import { grade, weight, GRADUATE } from "./record.js";
import { explain } from "./explain.js";
import { addDays } from "./date.js";

const parentId = idOf(process.env.REVIEW_PAGE_ID ?? "");
const sources = (process.env.SOURCE_PAGE_IDS ?? "").split(",").filter(Boolean).map(idOf);
if (!process.env.NOTION_TOKEN || !parentId || !sources.length) {
  throw new Error("NOTION_TOKEN, REVIEW_PAGE_ID, SOURCE_PAGE_IDS 환경변수가 필요합니다");
}
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST 기준 날짜
const PAGE_TITLE = /^오늘의 복습 (\d{4}-\d{2}-\d{2})$/; // 반영이 끝나면 제목 끝에 ✅가 붙어 더는 안 맞음
const LOOKBACK = 14; // 체크 안 한 페이지를 며칠 전까지 다시 볼지

// 1. 문장·플래시 카드 모으기 (Review 섹션 등에서 반복되는 것은 처음 것만)
const seen = new Set();
const items = [];
const flashes = [];
for (const pageId of sources) {
  for (const { lesson, section, lines, flash } of await collect(pageId)) {
    for (const card of parseLines(lines)) {
      if (seen.has(keyOf(card.en))) continue;
      seen.add(keyOf(card.en));
      items.push({ ...card, lesson, section });
    }
    for (const f of flash) if (f.front && f.back.length) flashes.push({ ...f, lesson, section });
  }
}
if (!items.length) {
  throw new Error("학습 페이지에서 문장을 하나도 못 찾았습니다. 통합이 페이지에 연결됐는지, 형식이 맞는지 확인하세요.");
}
const byKey = new Map(items.map((c) => [keyOf(c.en), c]));
const where = (c) => [c.lesson, c.section].filter(Boolean).join(" · ");

// 2. 지난 페이지의 알아요/몰라요 체크를 복습 기록 DB에 반영
const kids = await children(parentId);
const logId = await ensureLog(parentId, kids);
const records = new Map();
for (const row of await queryAll(logId)) {
  const p = row.properties;
  records.set(keyOf(plain(p[L.en].title)), {
    id: row.id, done: p[L.done].number ?? 0, lapses: p[L.lapses].number ?? 0, last: p[L.last].date?.start ?? null,
  });
}
const pending = kids
  .filter((b) => b.type === "child_page")
  .map((b) => ({ id: b.id, title: b.child_page.title, date: b.child_page.title.match(PAGE_TITLE)?.[1] }))
  .filter((p) => p.date && p.date < today && p.date >= addDays(today, -LOOKBACK))
  .sort((a, b) => a.date.localeCompare(b.date));
const changed = new Map();
let graded = 0;
for (const p of pending) {
  const grades = await readGrades(p.id);
  if (!grades.length) continue; // 아직 체크 안 한 페이지는 다음 실행 때 다시 봄
  for (const g of grades) {
    const key = keyOf(g.en);
    const rec = records.get(key) ?? { done: 0, lapses: 0, last: null, en: g.en, ko: byKey.get(key)?.ko ?? g.ko };
    records.set(key, grade(rec, g.grade, p.date));
    changed.set(key, records.get(key));
    graded++;
  }
  await renamePage(p.id, `${p.title} ✅`);
}
for (const [key, r] of changed) {
  const state = {
    [L.done]: { number: r.done },
    [L.lapses]: { number: r.lapses },
    [L.last]: { date: { start: r.last } },
  };
  if (r.id) await updateRow(r.id, state);
  else {
    const c = byKey.get(key);
    await createRow(logId, {
      [L.en]: { title: [{ text: { content: r.en } }] },
      [L.ko]: { rich_text: [{ text: { content: r.ko } }] },
      [L.source]: { rich_text: [{ text: { content: c ? where(c) : "" } }] },
      ...state,
    });
  }
}

// 3. 고르기: 완료 GRADUATE회 이상은 제외, 완료가 적을수록 자주. 고른 문장에만 단어 설명
const doneOf = (c) => records.get(keyOf(c.en))?.done ?? 0;
const pool = items.filter((c) => doneOf(c) < GRADUATE);
const picked = weightedPick(pool, DAILY_COUNT, (c) => weight(doneOf(c)));
const notes = await explain(picked.map((c) => c.en));
const pickedFlash = pick(flashes, FLASH_COUNT);

// 4. 페이지 만들기: 문장은 한국어 토글 → 영어·한글 발음·알아요/몰라요·출처·단어 설명
const text = (content, annotations) => ({ type: "text", text: { content }, ...(annotations && { annotations }) });
const para = (...rich) => ({ type: "paragraph", paragraph: { rich_text: rich } });
const todo = (s) => ({ type: "to_do", to_do: { rich_text: [text(s)], checked: false } });
const toggle = (title, children) => ({ type: "toggle", toggle: { rich_text: [text(title)], children } });
const source = (c, extra = "") => para(text(where(c) + extra, { color: "gray" }));
// 💡 prestigious  /prɛˈstɪdʒəs/ 프레스티저스
//    권위·명성 있는 (famous보다 격이 높음)
//    예) It's a prestigious award. 권위 있는 상이야.
const word = (w) =>
  para(
    text("💡 "),
    text(w.word, { bold: true }),
    text([w.ipa && `  /${w.ipa.replace(/^\/|\/$/g, "")}/`, w.sound && ` ${w.sound}`].filter(Boolean).join(""), { color: "gray" }),
    text(`\n${w.meaning}`),
    ...(w.example ? [text("\n예) "), text(w.example, { italic: true }), text(w.example_ko ? `  ${w.example_ko}` : "", { color: "gray" })] : []),
  );
const heading = (s) => ({ type: "heading_2", heading_2: { rich_text: [text(s)] } });

const blocks = [
  heading(`문장 (${picked.length})`),
  para(text("말해 본 뒤 토글을 열어 확인하고 알아요/몰라요를 체크하세요. 다음 날 새벽에 반영됩니다.", { color: "gray" })),
  ...picked.map((c, i) =>
    toggle(`${i + 1}. ${c.ko}`, [
      para(text(c.en, { bold: true })),
      ...(notes[i].sound ? [para(text(`🔊 ${notes[i].sound}`, { color: "gray" }))] : []),
      todo("알아요"),
      todo("몰라요"),
      source(c, ` · 완료 ${doneOf(c)}/${GRADUATE}`),
      ...notes[i].words.map(word),
    ]),
  ),
  ...(pickedFlash.length
    ? [heading(`문법 포인트 (${pickedFlash.length})`), ...pickedFlash.map((f) => toggle(f.front, [...f.back.map((b) => para(text(b))), source(f)]))]
    : []),
];
const title = `오늘의 복습 ${today}`;
for (const b of kids) if (b.type === "child_page" && b.child_page.title === title) await archivePage(b.id); // 같은 날 재실행
const page = await createPage(parentId, title, blocks);

const graduated = items.length - pool.length;
console.log(
  `[${today}] 채점 반영 ${graded}개, 졸업 ${graduated}개 · 문장 ${pool.length}개 중 ${picked.length}개 ` +
    `(단어 설명 ${notes.filter((n) => n.words.length).length}개), 플래시 카드 ${flashes.length}개 중 ${pickedFlash.length}개 → ${page.url}`,
);
