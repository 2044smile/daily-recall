import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLines, keyOf } from "../src/parse.js";

// 실제 Speak 정리 노트 일부
const note = `복습
If you wanna save money then budgeting is a good option 돈을 아끼고 싶다면, (그럼) 예산을 짜는 게 좋은 선택이야
I’ll think about it 생각해 볼게
비디오 레슨
She can’t make up her mind! 그녀는 마음을 못 정하고 있어요
결정 내리는데 어려움
leaning towards (마음이) 기울다
Which school are you leaning towards?
leaning towards; 그게 마음에 들고, 아마 그걸 선택할 가능성이 높다는 뜻
affordable; 합리적
* Why don’t you get a roommate?
너 룸메이트를 구하지 그래?`.split("\n");

test("한 줄·구분자·두 줄 형식을 모두 읽는다", () => {
  assert.deepEqual(parseLines(note), [
    { en: "If you wanna save money then budgeting is a good option", ko: "돈을 아끼고 싶다면, (그럼) 예산을 짜는 게 좋은 선택이야" },
    { en: "I’ll think about it", ko: "생각해 볼게" },
    { en: "She can’t make up her mind!", ko: "그녀는 마음을 못 정하고 있어요" },
    { en: "leaning towards", ko: "(마음이) 기울다" },
    { en: "leaning towards", ko: "그게 마음에 들고, 아마 그걸 선택할 가능성이 높다는 뜻" },
    { en: "affordable", ko: "합리적" },
    { en: "Why don’t you get a roommate?", ko: "너 룸메이트를 구하지 그래?" },
  ]);
});

test("중복 키는 따옴표·대소문자·문장부호를 무시한다", () => {
  assert.equal(keyOf("I’ll think about it!"), keyOf("i'll think  about it"));
});
