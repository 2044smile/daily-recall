// 노션 API 최소 클라이언트 (의존성 없이 fetch만 사용)
const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 복습 큐 DB 속성 이름. 노션에서 이름을 바꾸면 여기도 같이 바꿔야 합니다.
export const P = {
  ko: "한국어",
  en: "영어",
  grade: "평가",
  due: "다음 복습",
  stage: "단계",
  lapses: "틀린 횟수",
  today: "오늘",
  added: "추가일",
};

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

async function paginate(fetchPage) {
  const out = [];
  let cursor;
  do {
    const r = await fetchPage(cursor);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

// 페이지의 모든 텍스트를 줄 단위로 (하위 블록·하위 페이지 포함, 문서 순서대로)
export async function pageLines(blockId) {
  const blocks = await paginate((c) =>
    notion("GET", `/blocks/${blockId}/children?page_size=100${c ? `&start_cursor=${c}` : ""}`),
  );
  const lines = [];
  for (const b of blocks) {
    const rich = b[b.type]?.rich_text;
    // Shift+Enter 줄바꿈은 한 블록 안의 \n 으로 들어옴
    if (rich) lines.push(...rich.map((t) => t.plain_text).join("").split("\n"));
    if (b.has_children && b.type !== "child_database") lines.push(...(await pageLines(b.id)));
  }
  return lines;
}

export const queryAll = (dbId) =>
  paginate((c) => notion("POST", `/databases/${dbId}/query`, { page_size: 100, ...(c && { start_cursor: c }) }));

export const createRow = (dbId, properties) =>
  notion("POST", "/pages", { parent: { database_id: dbId }, properties });

export const updateRow = (pageId, properties) => notion("PATCH", `/pages/${pageId}`, { properties });
