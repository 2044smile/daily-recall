// 최초 1회: 지정한 노션 페이지 아래에 '복습 큐' DB를 만들고 ID를 출력
// 사용법: node --env-file=.env src/setup.js <부모 페이지 URL 또는 ID>
import { P, idOf, notion } from "./notion.js";

const parent = process.argv[2];
if (!parent) throw new Error("부모 페이지 URL 또는 ID를 인자로 주세요");

const db = await notion("POST", "/databases", {
  parent: { type: "page_id", page_id: idOf(parent) },
  title: [{ type: "text", text: { content: "복습 큐" } }],
  properties: {
    [P.ko]: { title: {} },
    [P.en]: { rich_text: {} },
    [P.grade]: {
      select: {
        options: [
          { name: "알아요", color: "green" },
          { name: "애매", color: "yellow" },
          { name: "몰라요", color: "red" },
        ],
      },
    },
    [P.today]: { checkbox: {} },
    [P.due]: { date: {} },
    [P.stage]: { number: {} },
    [P.lapses]: { number: {} },
    [P.added]: { date: {} },
  },
});
console.log(`복습 큐 생성 완료: ${db.url}`);
console.log(`REVIEW_DB_ID=${db.id.replaceAll("-", "")}`);
