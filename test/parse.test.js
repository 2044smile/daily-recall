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

test("블록 안 둘째 줄은 영어가 섞여 있어도 한국어 뜻으로 본다", () => {
  assert.deepEqual(parseLines(["The EV or the hybrid?\nEV 아니면 하이브리드?"]), [
    { en: "The EV or the hybrid?", ko: "EV 아니면 하이브리드?" },
  ]);
});

test("대화 표시는 지우고 문법 메모 조각은 버린다", () => {
  assert.deepEqual(parseLines(["A: Coffee is stronger than tea\n커피가 차보다 더 세", "way too + 형용사; 정말 너무", "thinking of 는 아직 결정된 게 없다는 뜻"]), [
    { en: "Coffee is stronger than tea", ko: "커피가 차보다 더 세" },
  ]);
});

test("제목 자리(빈 줄)를 넘어 짝짓지 않는다", () => {
  assert.deepEqual(parseLines(["Should I get ___ or ___?", "", "두 가지 옵션 중에 조언을 구해보세요!"]), []);
});

test("셋째 줄부터의 설명 메모는 버린다", () => {
  assert.deepEqual(parseLines(["Why don’t you sleep on it?\n하룻밤 자면서 생각해 봐\n→ sleep on it: 결정을 하루 미루다"]), [
    { en: "Why don’t you sleep on it?", ko: "하룻밤 자면서 생각해 봐" },
  ]);
});

test("영어 단어 뒤에 붙인 한글 발음 메모는 지운다", () => {
  assert.deepEqual(
    parseLines([
      "On the other hand, the suburbs[서벌브즈] are safer\n다른 한편으로는, 도시 외곽이 더 안전해",
      "Speak is more fun than its competitors[컴페리럴스]\nSpeak는 경쟁 서비스들보다 더 재미있습니다",
      "perk[퍼얼ㅋ]; 일반적인 장점보다 조금 더 매력적인 혜택",
    ]),
    [
      { en: "On the other hand, the suburbs are safer", ko: "다른 한편으로는, 도시 외곽이 더 안전해" },
      { en: "Speak is more fun than its competitors", ko: "Speak는 경쟁 서비스들보다 더 재미있습니다" },
      { en: "perk", ko: "일반적인 장점보다 조금 더 매력적인 혜택" },
    ],
  );
});

test("뜻 뒤의 → 설명은 버린다", () => {
  assert.deepEqual(parseLines(["Why don’t you sleep on it?\n하룻밤 자면서 생각해 봐 → sleep on it: 결정을 하루 미루다"]), [
    { en: "Why don’t you sleep on it?", ko: "하룻밤 자면서 생각해 봐" },
  ]);
});
