// 매일 1회: 학습 페이지 전체에서 문장을 모아 섞은 뒤 '오늘의 복습' 페이지를 만듦
import { idOf, collect, archiveChildPages, createPage } from "./notion.js";
import { parseLines, keyOf } from "./parse.js";
import { pick, DAILY_COUNT, FLASH_COUNT } from "./pick.js";
import { explain } from "./explain.js";

const parentId = idOf(process.env.REVIEW_PAGE_ID ?? "");
const sources = (process.env.SOURCE_PAGE_IDS ?? "").split(",").filter(Boolean).map(idOf);
if (!process.env.NOTION_TOKEN || !parentId || !sources.length) {
  throw new Error("NOTION_TOKEN, REVIEW_PAGE_ID, SOURCE_PAGE_IDS 환경변수가 필요합니다");
}
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST 기준 날짜

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

// 2. 섞어서 고르고, 고른 문장에만 단어 설명 붙이기
const picked = pick(items, DAILY_COUNT);
const notes = await explain(picked.map((c) => c.en));
const pickedFlash = pick(flashes, FLASH_COUNT);

// 3. 페이지 만들기: 문장은 한국어 토글 → 영어·한글 발음·출처·단어 설명 / 문법 포인트는 영어 토글 → 설명
const text = (content, annotations) => ({ type: "text", text: { content }, ...(annotations && { annotations }) });
const para = (...rich) => ({ type: "paragraph", paragraph: { rich_text: rich } });
const toggle = (title, children) => ({ type: "toggle", toggle: { rich_text: [text(title)], children } });
const source = (c) => para(text([c.lesson, c.section].filter(Boolean).join(" · "), { color: "gray" }));
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
  ...picked.map((c, i) =>
    toggle(`${i + 1}. ${c.ko}`, [
      para(text(c.en, { bold: true })),
      ...(notes[i].sound ? [para(text(`🔊 ${notes[i].sound}`, { color: "gray" }))] : []),
      source(c),
      ...notes[i].words.map(word),
    ]),
  ),
  ...(pickedFlash.length
    ? [heading(`문법 포인트 (${pickedFlash.length})`), ...pickedFlash.map((f) => toggle(f.front, [...f.back.map((b) => para(text(b))), source(f)]))]
    : []),
];
const title = `오늘의 복습 ${today}`;
await archiveChildPages(parentId, title);
const page = await createPage(parentId, title, blocks);

const explained = notes.filter((n) => n.words.length).length;
console.log(`[${today}] 문장 ${items.length}개 중 ${picked.length}개 (단어 설명 ${explained}개), 플래시 카드 ${flashes.length}개 중 ${pickedFlash.length}개 → ${page.url}`);
