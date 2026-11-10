// 학습 정리 텍스트 → [{ en, ko }]
// 지원 형식:
//   "I'll think about it 생각해 볼게"          (한 줄에 영어+한국어)
//   "affordable; 합리적"                      (구분자 ; : , - 허용)
//   "I'll think about it" / "생각해 볼게"      (영어 줄 바로 다음에 한국어 줄)
const HANGUL = /[가-힣]/;
const LATIN = /[A-Za-z]/;
const SAME_LINE = /^([^가-힣]*?[A-Za-z][^가-힣]*?)[\s;:,-]*([(\[]?[가-힣].*)$/;

const clean = (s) => s.replace(/^[\s*•·-]+/, "").trim();

export function parseLines(lines) {
  const cards = [];
  let pendingEn = null;
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
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
      pendingEn = null; // 한국어로 시작하는 줄, 제목 등은 건너뜀
    }
  }
  return cards;
}

// 중복 판별용: 대소문자·문장부호·따옴표 차이 무시
export const keyOf = (en) =>
  en
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
