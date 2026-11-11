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

async function children(blockId) {
  const out = [];
  let cursor;
  do {
    const r = await notion("GET", `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

const plain = (rich) => rich.map((t) => t.plain_text).join("");
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

// 부모 페이지 아래 같은 제목의 하위 페이지를 보관함으로 (재실행 시 중복 방지)
export async function archiveChildPages(parentId, title) {
  for (const b of await children(parentId)) {
    if (b.type === "child_page" && b.child_page.title === title) {
      await notion("PATCH", `/pages/${b.id}`, { archived: true });
    }
  }
}

export const createPage = (parentId, title, blocks) =>
  notion("POST", "/pages", {
    parent: { page_id: parentId },
    icon: { emoji: "📝" },
    properties: { title: { title: [{ text: { content: title } }] } },
    children: blocks,
  });
