// 학습 정리 텍스트 → [{ en, ko }]
// 입력은 블록 단위 문자열 배열 (한 블록 안의 Shift+Enter 줄바꿈은 \n)
// 지원 형식:
//   "I'll think about it\n생각해 볼게"          (한 블록 안에 영어 줄 + 한국어 줄, 가장 흔함)
//   "I'll think about it 생각해 볼게"          (한 줄에 영어+한국어)
//   "affordable; 합리적"                      (구분자 ; : , - 허용)
//   "I'll think about it" / "생각해 볼게"      (영어 블록 바로 다음 블록이 한국어만)
const HANGUL = /[가-힣]/;
const LATIN = /[A-Za-z]/;
const SAME_LINE = /^([^가-힣]*?[A-Za-z][^가-힣]*?)[\s;:,-]*([(\[]?[가-힣].*)$/;

// 영어 단어 뒤에 붙인 한글 발음 메모는 지움: "suburbs[서벌브즈]" → "suburbs"
const clean = (s) =>
  s
    .replace(/([A-Za-z])\s*\[[^\]]*[가-힣ㄱ-ㅎ][^\]]*\]/g, "$1")
    .replace(/^[\s*•·-]+/, "")
    .replace(/^[AB]:\s*/, "")
    .trim();

// 문법 메모 조각은 카드로 쓰지 않음: "way too + 형용사", "thinking of 는 ~를 의미"
const isFragment = ({ en, ko }) => /\+$/.test(en) || /^[은는의을를이가]\s/.test(ko);

function parseFlat(lines) {
  const cards = [];
  let pendingEn = null;
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) {
      pendingEn = null; // 빈 줄(제목 자리)을 넘어 짝짓지 않음
      continue;
    }
    const hasKo = HANGUL.test(line);
    const hasEn = LATIN.test(line);
    const m = hasKo && hasEn && line.match(SAME_LINE);
    if (m) {
      cards.push({ en: m[1].trim(), ko: m[2].trim() });
      pendingEn = null;
    } else if (hasEn && !hasKo) {
      pendingEn = line;
    } else if (hasKo && !hasEn && pendingEn) {
      cards.push({ en: pendingEn, ko: line });
      pendingEn = null;
    } else {
      pendingEn = null; // 한국어로 시작하는 줄 등은 건너뜀
    }
  }
  return cards;
}

export function parseLines(blocks) {
  const cards = [];
  let flat = [];
  for (const block of blocks) {
    const [first, second] = block.split("\n").map(clean);
    // 블록 안 둘째 줄은 영어가 섞여 있어도 한국어 뜻 ("The EV or the hybrid?\nEV 아니면 하이브리드?")
    // 셋째 줄부터는 설명 메모라 버림
    if (second && LATIN.test(first) && !HANGUL.test(first) && HANGUL.test(second)) {
      cards.push(...parseFlat(flat), { en: first, ko: second });
      flat = [];
    } else {
      flat.push(...block.split("\n"));
    }
  }
  cards.push(...parseFlat(flat));
  // 뜻 뒤의 "→ sleep on it: ..." 같은 설명은 버림
  return cards.map((c) => ({ ...c, ko: c.ko.replace(/\s*→.*$/, "") })).filter((c) => c.ko && !isFragment(c));
}

// 중복 판별용: 대소문자·문장부호·따옴표 차이 무시
export const keyOf = (en) =>
  en
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
