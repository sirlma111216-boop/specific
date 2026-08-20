import { countCharacters } from "@/lib/utils";

export type IssueCode =
  | "length"
  | "first_person"
  | "sentence_ending"
  | "negative_or_overpraise"
  | "reflection_underused"
  | "fabricated_detail"
  | "missing_date";

export interface ValidationIssue {
  code: IssueCode;
  message: string;
  /** 재생성 요청 프롬프트에 넣을 구체적 지시 */
  instruction: string;
}

export interface ValidationInput {
  text: string;
  targetLength: number;
  /** 목표 대비 허용 오차 비율. 기본 ±5% */
  tolerance?: number;
  events: Array<{
    title: string;
    hasStudentReflection: boolean;
    studentReflection: string;
    /** 생기부 표기 날짜(2026.08.19.). 본문에 들어갔는지 확인하는 데 쓴다. */
    eventDate?: string;
  }>;
}

export interface ValidationResult {
  ok: boolean;
  characterCount: number;
  issues: ValidationIssue[];
}

/* ── 검증 2: 학생 1인칭 표현 ─────────────────────────────── */
const FIRST_PERSON = [
  "나는", "내가", "나의", "저는", "제가", "저의", "우리는",
  "생각했다", "느꼈다", "느꼈음", "생각한다", "느낀다",
  "재미있었다", "좋았다", "싶다", "싶었다",
];

/* ── 검증 4: 부정 평가 + 근거 없는 과대 평가 ────────────── */
const NEGATIVE_WORDS = [
  "부족함", "부족한", "미흡", "소극적", "관심이 낮", "성실하지", "이해가 낮",
  "참여도가 낮", "노력이 필요", "산만", "어려움을 보임",
];
const OVERPRAISE_WORDS = [
  "매우 뛰어남", "탁월", "또래보다 우수", "모범적임", "최고", "완벽",
  "타의 추종", "발군",
];

/* ── 검증 6: 확인 불가능한 구체적 성취 ──────────────────── */
const FABRICATION_MARKERS = [
  "수상", "최우수", "우수상", "장려상", "대상을", "1위", "우승",
  "대표로", "회장", "부회장", "반장", "부반장",
  "시범을 보임", "모범이 됨", "또래의 모범", "만점", "자격증", "전교",
];
/** 학교생활기록부 기재요령상 특기사항에 넣을 수 없는 고유명사류 */
const FORBIDDEN_PROPER_NOUNS = ["대학교", "주식회사", "㈜", "학원", "강사"];

const HANGUL_BASE = 0xac00;
const JONG_MIEUM = 16; // 종성 'ㅁ'

/** 생기부 종결어미(-ㅁ/-음)인지: 마지막 글자의 종성이 ㅁ인지로 판정한다. */
export function endsWithNounForm(sentence: string): boolean {
  const cleaned = stripTrailingParenthetical(sentence);
  const last = cleaned.at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0) - HANGUL_BASE;
  if (code < 0 || code > 11171) return false;
  return code % 28 === JONG_MIEUM;
}

function stripTrailingParenthetical(sentence: string): string {
  let s = sentence.trim().replace(/[.\s]+$/g, "");
  // "…양성평등교육(4시간)" 처럼 괄호로 끝나면 괄호를 떼고 어미를 본다.
  while (s.endsWith(")") || s.endsWith("）")) {
    const open = Math.max(s.lastIndexOf("("), s.lastIndexOf("（"));
    if (open <= 0) break;
    s = s.slice(0, open).trim();
  }
  return s;
}

/** 마침표 뒤에 공백이나 끝이 오는 지점에서만 자른다. (2026.03.04. 같은 날짜를 깨지 않기 위함) */
export function splitSentences(text: string): string[] {
  return text
    .split(/\.(?=\s|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 활동명에서 본문 언급 여부를 확인할 키워드를 뽑는다. */
function titleKeywords(title: string): string[] {
  const compact = title.replace(/\s+/g, "");
  const tokens = title
    .split(/[\s·,()[\]-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set([compact, ...tokens])).filter((t) => t.length >= 2);
}

function mentionsEvent(text: string, title: string): boolean {
  const flat = text.replace(/\s+/g, "");
  return titleKeywords(title).some((kw) => flat.includes(kw.replace(/\s+/g, "")));
}

/**
 * 생성 결과를 서버에서 다시 검증한다. 요구사항 46의 검증 1~6에 대응.
 * 문제가 있으면 issues에 담고, 호출자는 최대 재시도 횟수 안에서 수정 생성을 요청한다.
 */
export function validateRecordDraft(input: ValidationInput): ValidationResult {
  const { text, targetLength, tolerance = 0.05, events } = input;
  const issues: ValidationIssue[] = [];
  const characterCount = countCharacters(text);

  // 검증 1 — 목표 글자 수
  const allowed = Math.max(10, Math.round(targetLength * tolerance));
  const low = targetLength - allowed;
  const high = targetLength + allowed;
  if (characterCount < low || characterCount > high) {
    issues.push({
      code: "length",
      message: `글자 수가 목표 범위를 벗어났습니다. (${characterCount}자 / 목표 ${low}~${high}자)`,
      instruction:
        characterCount > high
          ? `분량이 ${characterCount}자로 깁니다. 공백 포함 ${low}~${high}자가 되도록 줄이되, 학생이 직접 작성한 활동 내용은 남기고 학생 기록이 없는 활동부터 덜어내라.`
          : `분량이 ${characterCount}자로 짧습니다. 학생이 직접 작성한 활동의 성찰 내용을 더 구체적으로 풀어 공백 포함 ${low}~${high}자로 맞춰라.`,
    });
  }

  // 검증 2 — 학생 1인칭 표현
  const foundFirstPerson = FIRST_PERSON.filter((w) => text.includes(w));
  if (foundFirstPerson.length > 0) {
    issues.push({
      code: "first_person",
      message: `학생 1인칭 표현이 남아 있습니다. (${foundFirstPerson.join(", ")})`,
      instruction: `학생 1인칭 표현(${foundFirstPerson.join(", ")})을 모두 제거하고 교사 관찰자 시점으로 바꿔라.`,
    });
  }

  // 검증 3 — 종결어미
  const sentences = splitSentences(text);
  const badEndings = sentences.filter((s) => !endsWithNounForm(s));
  if (badEndings.length > 0) {
    issues.push({
      code: "sentence_ending",
      message: `생활기록부 종결어미(~함/~임/~음/~보임)가 아닌 문장이 ${badEndings.length}개 있습니다.`,
      instruction: `모든 문장을 '~함.', '~임.', '~음.', '~보임.', '~평가됨.' 형태로 끝내라. 특히 다음 문장을 고쳐라: "${badEndings[0]}".`,
    });
  }

  // 검증 4 — 부정 평가 / 과대 평가
  const negatives = NEGATIVE_WORDS.filter((w) => text.includes(w));
  const overpraise = OVERPRAISE_WORDS.filter((w) => text.includes(w));
  if (negatives.length > 0 || overpraise.length > 0) {
    const found = [...negatives, ...overpraise].join(", ");
    issues.push({
      code: "negative_or_overpraise",
      message: `부정적 평가 또는 근거 없는 과대 평가 표현이 있습니다. (${found})`,
      instruction: `부정적 평가와 근거 없는 과대 평가 표현(${found})을 삭제하고, 확인되는 사실과 성장 가능성 중심으로 다시 써라.`,
    });
  }

  // 검증 5 — 학생 기록 있는 활동이 빠지고 기록 없는 활동만 강조되었는가
  const missingReflected = events
    .filter((e) => e.hasStudentReflection && !mentionsEvent(text, e.title))
    .map((e) => e.title);
  const includedUnreflected = events
    .filter((e) => !e.hasStudentReflection && mentionsEvent(text, e.title))
    .map((e) => e.title);
  if (missingReflected.length > 0 && includedUnreflected.length > 0) {
    issues.push({
      code: "reflection_underused",
      message: `학생이 직접 작성한 활동(${missingReflected.join(", ")})이 빠지고, 기록 없는 활동(${includedUnreflected.join(", ")})이 대신 들어갔습니다.`,
      instruction: `학생이 직접 작성한 활동(${missingReflected.join(", ")})을 반드시 포함하고, 학생 기록이 없는 활동(${includedUnreflected.join(", ")})은 분량을 줄이거나 빼라.`,
    });
  }

  // 검증 6 — 원본에 없는 구체적 행동·성취
  const sourceText = events.map((e) => e.studentReflection ?? "").join(" ");
  const fabricated = [...FABRICATION_MARKERS, ...FORBIDDEN_PROPER_NOUNS].filter(
    (marker) => text.includes(marker) && !sourceText.includes(marker),
  );
  if (fabricated.length > 0) {
    issues.push({
      code: "fabricated_detail",
      message: `학생 기록에 없는 구체적 행동·성취 또는 기재 금지 표현이 있습니다. (${fabricated.join(", ")})`,
      instruction: `학생이 실제로 작성한 내용에 근거가 없는 표현(${fabricated.join(", ")})을 삭제하라. 대학명·기관명·상호명·강사명은 생활기록부에 기재할 수 없다.`,
    });
  }

  // 검증 7 — 활동명 뒤 날짜 표기 (기재요령 관례)
  // 본문에 언급된 활동만 본다. 분량 때문에 아예 빠진 활동은 여기서 문제 삼지 않는다.
  const missingDates = events
    .filter((e) => e.eventDate && mentionsEvent(text, e.title) && !text.includes(e.eventDate))
    .map((e) => `${e.title}(${e.eventDate})`);
  if (missingDates.length > 0) {
    issues.push({
      code: "missing_date",
      message: `활동명 뒤 날짜 표기가 빠졌습니다. (${missingDates.join(", ")})`,
      instruction: `각 활동을 처음 언급할 때 활동명 바로 뒤 괄호 안에 날짜를 넣어라. 예: ${missingDates[0]}에 참여하여 …`,
    });
  }

  return { ok: issues.length === 0, characterCount, issues };
}

/** 검증에서 걸린 항목들을 한 번의 수정 요청 문장으로 합친다. */
export function buildRepairInstruction(issues: ValidationIssue[], targetLength: number): string {
  const lines = issues.map((i, idx) => `${idx + 1}. ${i.instruction}`);
  return [
    "다음 초안을 아래 지적사항에 맞게 수정하라. 새로운 사실을 지어내지 말고, 학생이 직접 작성한 활동 내용을 우선적으로 반영하라.",
    ...lines,
    `최종 결과는 공백 포함 ${targetLength}자 내외의 특기사항 본문만 출력한다.`,
  ].join("\n");
}
