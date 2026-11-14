// Gemini 무료 API로 문장마다 한글 발음과 중고급 단어·표현의 뜻·발음·예문 붙이기 (하루 1회 호출)
// GEMINI_API_KEY가 없거나 호출이 실패하면 빈 설명으로 넘어감
// 앞 모델이 혼잡하면 다음 모델로. GEMINI_MODEL을 주면 그 모델을 먼저 시도
const MODELS = [
  ...new Set([process.env.GEMINI_MODEL, "gemini-3-flash-preview", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean)),
];

const PROMPT = `너는 한국인 중급 영어 학습자를 돕는 선생님이야.
각 영어 문장마다 sound에 문장 전체를 원어민이 자연스럽게 말하는 소리를 한글로 적어.
연음·축약·약하게 발음되는 소리를 반영해 (예: getting → 게링, want to → 워너, Are you → 아유, but I → 버라이).
그리고 각 문장에서 중고급(CEFR B2 이상) 단어, 숙어, 구동사, 표현을 0~3개 골라
각각 다음을 채워.
- meaning: 한국어 뜻과 짧은 뉘앙스(쉬운 비슷한 단어와의 차이, 쓰는 상황) 한 줄
- ipa: 미국식 IPA 발음기호 (슬래시 없이)
- sound: 한글로 적은 발음 (예: 프레스티저스)
- example: 원래 문장과 다른, 원어민이 일상에서 자주 쓰는 짧은 예문 하나
- example_ko: 그 예문의 자연스러운 한국어 해석
get, good, phone, want 같은 기초 단어는 고르지 마. 고를 게 없으면 빈 배열로 둬.
i는 문장 번호를 그대로 써.`;

const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      i: { type: "INTEGER" },
      sound: { type: "STRING" },
      words: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            word: { type: "STRING" },
            meaning: { type: "STRING" },
            ipa: { type: "STRING" },
            sound: { type: "STRING" },
            example: { type: "STRING" },
            example_ko: { type: "STRING" },
          },
          required: ["word", "meaning", "ipa", "sound", "example", "example_ko"],
        },
      },
    },
    required: ["i", "sound", "words"],
  },
};

// sentences: 영어 문장 배열 → 같은 길이의 [{ sound, words: [{ word, meaning, ipa, sound, example, example_ko }] }] 배열
export async function explain(sentences) {
  const empty = sentences.map(() => ({ sound: "", words: [] }));
  if (!process.env.GEMINI_API_KEY || !sentences.length) return empty;
  try {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: `${PROMPT}\n\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}` }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
    });
    // 무료 등급은 모델별로 과부하(503)·한도(429)·무응답이 잦아서
    // 모델마다 한 번 더 기다렸다 시도하고, 그래도 안 되면 다음 모델로 넘어감
    const errors = [];
    for (const model of MODELS) {
      for (const wait of [15, null]) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
            body,
            signal: AbortSignal.timeout(120_000),
          });
          const data = await res.json();
          if (res.ok) {
            console.log(`Gemini ${model} 응답`);
            return toNotes(JSON.parse(data.candidates[0].content.parts[0].text), sentences.length);
          }
          errors.push(`${model} ${res.status}`);
          if (![429, 500, 503].includes(res.status)) break; // 404 등은 기다려도 소용없음
        } catch (e) {
          errors.push(`${model} ${e.name === "TimeoutError" ? "시간 초과" : e.message}`);
        }
        if (wait === null) break;
        console.warn(`Gemini ${errors.at(-1)}, ${wait}초 뒤 다시 시도`);
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
    }
    throw new Error(errors.join(", "));
  } catch (e) {
    console.warn(`단어 설명을 건너뜁니다 (Gemini: ${e.message})`);
    return empty;
  }
}

export function toNotes(rows, n) {
  const notes = Array.from({ length: n }, () => ({ sound: "", words: [] }));
  for (const { i, sound, words } of rows) {
    if (notes[i - 1]) notes[i - 1] = { sound: sound ?? "", words: (words ?? []).filter((w) => w.word && w.meaning) };
  }
  return notes;
}
