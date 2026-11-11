// 노션 API 최소 클라이언트 (의존성 없이 fetch만 사용)
const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 노션 URL이나 하이픈 섞인 ID에서 32자리 ID만 꺼냄
export const idOf = (s) => s.split(/[?#]/)[0].replaceAll("-", "").trim().match(/[0-9a-f]{32}$/i)?.[0] ?? s.trim();

export async function notion(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": VERSION,
        "Content-Type": "application/json",
      },
      body: body && JSON.stringify(body),
    });
    if (res.status === 429 && attempt < 5) {
      await sleep(Number(res.headers.get("retry-after") ?? 1) * 1000);
      continue;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.code}: ${data.message}`);
    await sleep(350); // 초당 3요청 제한
    return data;
  }
}

export async function children(blockId) {
  const out = [];
  let cursor;
  do {
    const r = await notion("GET", `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

export const plain = (rich) => rich.map((t) => t.plain_text).join("");
const LIST = new Set(["bulleted_list_item", "numbered_list_item"]);
const NOTES = new Set(["quote", "callout", "child_database"]);
const FLASH = /플래시\s*카드/;

// 페이지를 문서 순서대로 훑어 [{ lesson, section, lines, flash }] 구간으로 나눔
// 하위 페이지 = 레슨 (더 깊은 하위 페이지는 "레슨 › with AI"), 제목1(# 비디오 레슨 등) = 섹션
// '플래시 카드' 섹션은 ## 제목 = 앞면, 그 아래 블록 = 뒷면 설명으로 flash에 따로 모음
export async function collect(pageId) {
  const page = await notion("GET", `/pages/${pageId}`);
  const title = plain(Object.values(page.properties).find((p) => p.type === "title")?.title ?? []);
  const out = [];
  await walk(pageId, { lesson: title, section: "", root: true }, out);
  return out;
}

async function walk(blockId, ctx, out) {
  for (const b of await children(blockId)) {
    if (b.type === "child_page") {
      const title = b.child_page.title;
      await walk(b.id, { lesson: ctx.root ? title : `${ctx.lesson} › ${title}`, section: "" }, out);
      continue;
    }
    if (NOTES.has(b.type)) continue; // 인용·콜아웃은 문법 설명
    const rich = b[b.type]?.rich_text;
    if (b.type === "heading_1") ctx.section = plain(rich).trim();
    let seg = out.at(-1);
    if (!seg || seg.lesson !== ctx.lesson || seg.section !== ctx.section) {
      out.push((seg = { lesson: ctx.lesson, section: ctx.section, lines: [], flash: [] }));
    }
    if (FLASH.test(ctx.section) && b.type !== "heading_1") {
      const text = rich ? plain(rich).trim() : "";
      if (b.type === "heading_2") seg.flash.push({ front: text, back: [] });
      else if (text) seg.flash.at(-1)?.back.push(text);
      if (b.has_children) await walk(b.id, ctx, out); // 플래시 카드는 들여쓴 메모까지 뒷면
      continue;
    }
    // 제목은 카드가 아님. 빈 줄을 넣어 앞뒤 문장과 짝지어지지 않게 함
    if (b.type.startsWith("heading_")) seg.lines.push("");
    // 블록 단위로 넘김. Shift+Enter 줄바꿈은 한 블록 안의 \n 으로 들어옴
    else if (rich) seg.lines.push(plain(rich));
    // 목록 항목 아래 들여쓴 블록은 단어 설명 메모라 건너뜀
    if (b.has_children && !LIST.has(b.type)) await walk(b.id, ctx, out);
  }
}

export const archivePage = (pageId) => notion("PATCH", `/pages/${pageId}`, { archived: true });

export const renamePage = (pageId, title) =>
  notion("PATCH", `/pages/${pageId}`, { properties: { title: { title: [{ text: { content: title } }] } } });

// 복습 기록 DB 속성 이름. 노션에서 이름을 바꾸면 여기도 같이 바꿔야 합니다.
export const L = {
  en: "영어",
  ko: "한국어",
  source: "출처",
  done: "완료",
  lapses: "몰라요",
  last: "마지막 복습",
};
const LOG_TITLE = "복습 기록";

// 부모 페이지 아래 '복습 기록' DB를 찾고, 없으면 만듦
export async function ensureLog(parentId, kids) {
  const found = kids.find((b) => b.type === "child_database" && b.child_database.title === LOG_TITLE);
  if (found) return found.id;
  const db = await notion("POST", "/databases", {
    parent: { type: "page_id", page_id: parentId },
    title: [{ type: "text", text: { content: LOG_TITLE } }],
    properties: {
      [L.en]: { title: {} },
      [L.ko]: { rich_text: {} },
      [L.source]: { rich_text: {} },
      [L.done]: { number: {} },
      [L.lapses]: { number: {} },
      [L.last]: { date: {} },
    },
  });
  return db.id;
}

export async function queryAll(dbId) {
  const out = [];
  let cursor;
  do {
    const r = await notion("POST", `/databases/${dbId}/query`, { page_size: 100, ...(cursor && { start_cursor: cursor }) });
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

export const createRow = (dbId, properties) => notion("POST", "/pages", { parent: { database_id: dbId }, properties });
export const updateRow = (pageId, properties) => notion("PATCH", `/pages/${pageId}`, { properties });

// 지난 복습 페이지에서 문장별 체크 읽기 → [{ en, ko, grade: "알아요" | "몰라요" }]
// 둘 다 체크했으면 몰라요로 봄. 체크 안 한 문장은 빼고 돌려줌
export async function readGrades(pageId) {
  const out = [];
  for (const t of await children(pageId)) {
    if (t.type !== "toggle" || !t.has_children) continue;
    const title = plain(t.toggle.rich_text);
    const m = title.match(/^\d+\.\s*(.*)$/);
    if (!m) continue; // 문법 포인트 토글은 채점 대상 아님
    const kids = await children(t.id);
    const en = kids.find((b) => b.type === "paragraph");
    const checked = new Set(kids.filter((b) => b.type === "to_do" && b.to_do.checked).map((b) => plain(b.to_do.rich_text).trim()));
    const grade = checked.has("몰라요") ? "몰라요" : checked.has("알아요") ? "알아요" : null;
    if (en && grade) out.push({ en: plain(en.paragraph.rich_text), ko: m[1], grade });
  }
  return out;
}

export const createPage = (parentId, title, blocks) =>
  notion("POST", "/pages", {
    parent: { page_id: parentId },
    icon: { emoji: "📝" },
    properties: { title: { title: [{ text: { content: title } }] } },
    children: blocks,
  });
