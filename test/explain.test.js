import { test } from "node:test";
import assert from "node:assert/strict";
import { toNotes } from "../src/explain.js";

test("Gemini 응답을 문장 순서대로 맞추고, 빠지거나 범위 밖 번호는 빈 설명", () => {
  const rows = [
    { i: 2, sound: "프라이빗 칼리쥐즈", words: [{ word: "prestigious", meaning: "권위 있는" }, { word: "", meaning: "빈 단어" }] },
    { i: 9, sound: "x", words: [{ word: "x", meaning: "y" }] },
  ];
  const none = { sound: "", words: [] };
  assert.deepEqual(toNotes(rows, 3), [none, { sound: "프라이빗 칼리쥐즈", words: [{ word: "prestigious", meaning: "권위 있는" }] }, none]);
});
