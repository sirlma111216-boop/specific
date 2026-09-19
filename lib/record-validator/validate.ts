import { countCharacters } from "@/lib/utils";

export type IssueCode =
  | "length"
  | "first_person"
  | "sentence_ending"
  | "negative_or_overpraise"
  | "reflection_underused"
  | "fabricated_detail"
  | "missing_date"
  | "officer_missing"
  | "personal_missing"
  | "foreign_script"
  | "observer_voice"
  | "connective_word";

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
  /** 기재요령 형식으로 완성된 임원 재임 표기. 있으면 첫 문장에 나와야 한다. */
  officerTerms?: string[];
  /** 담임이 적은 한 줄 리더십 메모. 근거 자료이므로 허구 판정에서 제외한다. */
  officerNotes?: string[];
  /** 담당 교사가 따로 남긴 개인 활동. 교사가 확인한 사실이라 근거 자료로 본다. */
  personalActivities?: Array<{
    title: string;
    /** 생기부 표기 날짜. 본문에 들어갔는지 확인하는 데 쓴다. */
    activityDate?: string;
    content: string;
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
// 한국어는 낱말 경계가 없어 부분 일치 오탐이 난다.
// "전교"는 "안(전교)육"에 걸려, 안전교육이 들어간 기록마다 없는 문제를 만들어냈다.
// 지어낸 성취를 가리키는 표현만 구체적으로 적는다.
const FABRICATION_MARKERS = [
  "수상", "최우수", "우수상", "장려상", "대상을", "1위", "우승",
  "대표로", "회장", "부회장", "반장", "부반장",
  "시범을 보임", "모범이 됨", "또래의 모범", "만점", "자격증",
  "전교 회장", "전교회장", "전교 부회장", "전교부회장",
  "전교 학생회", "전교학생회", "전교 1등", "전교 최상위",
];
/** 학교생활기록부 기재요령상 특기사항에 넣을 수 없는 고유명사류 */
const FORBIDDEN_PROPER_NOUNS = ["대학교", "주식회사", "㈜", "학원", "강사"];

/* ── 검증 9: 한글이 아닌 문자(한자·가나·전각기호) ────────
   생활기록부는 한글로 적는다. 한자는 두 갈래로 들어온다.
   1) 활동명·학생 소감에 한자가 섞여 있으면 모델이 그대로 옮긴다(실측 4/4).
   2) 모델이 스스로 섞는 경우(실측 38회 중 0건이지만 배제할 수 없다).
   리터럴 한자를 소스에 적으면 저장 과정에서 호환한자(U+F900)가 일반한자(U+8C48)로
   정규화되어 범위가 한글(U+AC00~)까지 삼킨다. 반드시 코드포인트로 적을 것. */
const HANJA_RE = new RegExp("[\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF]", "gu");
const KANA_RE = new RegExp("[\\u3040-\\u30FF]", "gu");
const FULLWIDTH_RE = new RegExp("[\\u3000-\\u303F\\uFF01-\\uFF60]", "gu");

/* ── 검증 11: 활동 사이 접속 표현 ────────────────────────
   "또한 안전교육에 참여하여…"처럼 다음 활동을 접속어로 시작하는 문장을 잡는다.
   생기부는 활동별 독립 서술을 이어 붙이는 문서라 이런 연결어가 어색하다. */
const CONNECTIVE_STARTS = [
  "또한",
  "그리고",
  "더불어",
  "아울러",
  "한편",
  "이어서",
  "이와 함께",
  "이에 더해",
  "다음으로",
  "뿐만 아니라",
];

/** 문장이 활동 연결어로 시작하는지. 앞의 따옴표·공백은 무시한다. */
export function startsWithConnective(sentence: string): boolean {
  const s = sentence.trim().replace(/^["'“”‘’]+/, "").trimStart();
  return CONNECTIVE_STARTS.some((w) => s.startsWith(w));
}

/* ── 검증 10: 교사 관찰자 시점 종결 ──────────────────────
   '~함/~임/~음'은 종결어미 규칙(검증 3)만 만족시킬 뿐, '인식함/성찰함'처럼
   학생 관점 서술로도 성립한다. 관찰자 표현이 마지막 문장에만 몰리는 일을 막는다. */
const OBSERVER_ENDINGS = [
  "보임",
  "관찰됨",
  "평가됨",
  "나타남",
  "드러냄",
  "확인됨",
  "판단됨",
  "여겨짐",
  "기대됨",
];

/** 교사가 관찰·평가한 서술로 끝나는 문장인지. */
export function hasObserverEnding(sentence: string): boolean {
  const s = stripTrailingParenthetical(sentence);
  return OBSERVER_ENDINGS.some((m) => s.endsWith(m));
}

/** 문장 수 대비 최소로 필요한 관찰자 시점 종결 문장 수. */
export function requiredObserverSentences(sentenceCount: number): number {
  return Math.ceil(sentenceCount / 2);
}

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
  const officerTerms = input.officerTerms ?? [];
  const officerNotes = input.officerNotes ?? [];
  const personalActivities = input.personalActivities ?? [];
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
  // 임원 재임과 담당 교사가 남긴 개인 활동은 교사가 확인한 사실이므로 근거 자료에 포함한다.
  // (이게 없으면 '회장', '대표로' 같은 단어가 허구 성취로 잘못 걸린다)
  const sourceText = [
    ...events.map((e) => e.studentReflection ?? ""),
    ...officerTerms,
    ...officerNotes,
    ...personalActivities.map((a) => `${a.title} ${a.content}`),
  ].join(" ");
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
  const missingDates = [
    ...events.map((e) => ({ title: e.title, date: e.eventDate })),
    ...personalActivities.map((a) => ({ title: a.title, date: a.activityDate })),
  ]
    .filter((e) => e.date && mentionsEvent(text, e.title) && !text.includes(e.date))
    .map((e) => `${e.title}(${e.date})`);
  if (missingDates.length > 0) {
    issues.push({
      code: "missing_date",
      message: `활동명 뒤 날짜 표기가 빠졌습니다. (${missingDates.join(", ")})`,
      instruction: `각 활동을 처음 언급할 때 활동명 바로 뒤 괄호 안에 날짜를 넣어라. 예: ${missingDates[0]}에 참여하여 …`,
    });
  }

  // 검증 8 — 자치활동 임원 표기가 맨 앞에 있는가
  if (officerTerms.length > 0) {
    const missing = officerTerms.filter((t) => !text.includes(t));
    const firstSentence = sentences[0] ?? "";
    const leadsWithOfficer = officerTerms.some((t) => firstSentence.includes(t));

    if (missing.length > 0) {
      issues.push({
        code: "officer_missing",
        message: `임원 재임 표기가 빠졌습니다. (${missing.join(", ")})`,
        instruction: `첫 문장을 임원 활동으로 시작하고 다음 표기를 형식 그대로 넣어라: ${missing.join(", ")}`,
      });
    } else if (!leadsWithOfficer) {
      issues.push({
        code: "officer_missing",
        message: "임원 재임 표기가 첫 문장에 있지 않습니다.",
        instruction: `임원 활동을 맨 앞으로 옮겨라. 첫 문장이 "${officerTerms[0]}"으로 시작해야 한다.`,
      });
    }
  }

  // 검증 8-2 — 담임이 체크한 개인 활동이 빠지지 않았는가
  // 담당 교사가 확인해 남긴 활동이고 담임이 직접 골랐으므로, 분량을 이유로 빠지면 안 된다.
  // (이 누락을 막는 것이 개인 활동 기록을 앱으로 옮긴 이유다)
  const missingPersonal = personalActivities
    .filter((a) => !mentionsEvent(text, a.title))
    .map((a) => a.title);
  if (missingPersonal.length > 0) {
    issues.push({
      code: "personal_missing",
      message: `담임이 체크한 개인 활동이 빠졌습니다. (${missingPersonal.join(", ")})`,
      instruction: `담당 교사가 기록한 개인 활동(${missingPersonal.join(", ")})을 반드시 포함하라. 활동명 뒤 괄호에 주어진 날짜를 그대로 넣고, 메모를 옮겨 적지 말고 교사 관찰자 시점으로 압축해 1~2문장으로 써라.`,
    });
  }

  // 검증 9 — 한자·가나·전각기호
  // 활동명이나 학생 소감에 한자가 있으면 모델이 그대로 옮겨 적는다.
  // 후처리(cleanDraft)에서 걸러지지 않고 남은 것만 여기서 잡힌다.
  const foreign = Array.from(
    new Set([
      ...(text.match(HANJA_RE) ?? []),
      ...(text.match(KANA_RE) ?? []),
      ...(text.match(FULLWIDTH_RE) ?? []),
    ]),
  );
  if (foreign.length > 0) {
    issues.push({
      code: "foreign_script",
      message: `한글이 아닌 문자가 섞여 있습니다. (${foreign.join(" ")})`,
      instruction: `본문에서 한자·일본어 문자와 전각 기호(${foreign.join(" ")})를 모두 없애고 한글로만 다시 써라. 활동명에 한자가 들어 있으면 한글 부분만 남기고 한자와 그 괄호는 빼라.`,
    });
  }

  // 검증 10 — 교사 관찰자 시점 종결이 고르게 쓰였는가
  // 검증 3(종결어미)은 '인식함/성찰함'처럼 학생 관점 서술도 통과시킨다.
  // 관찰자 표현이 마지막 문장에만 몰리면 앞·중간이 학생 관점으로 남는다.
  if (sentences.length >= 2) {
    const observerFlags = sentences.map((s) => hasObserverEnding(s));
    const observerCount = observerFlags.filter(Boolean).length;
    const required = requiredObserverSentences(sentences.length);
    if (observerCount < required) {
      const plain = sentences.filter((_, i) => !observerFlags[i]);
      issues.push({
        code: "observer_voice",
        message: `교사 관찰자 시점으로 끝나는 문장이 ${observerCount}/${sentences.length}개뿐입니다. (최소 ${required}개)`,
        instruction:
          `학생 관점의 단순 서술('~인식함', '~성찰함', '~이해함', '~함양함')로 끝나는 문장을 교사가 관찰한 서술로 바꿔라. ` +
          `마지막 문장에만 몰지 말고 첫 문장과 중간 문장에도 고르게 넣어, 전체 ${sentences.length}개 문장 중 최소 ${required}개가 ` +
          `'~하는 모습을 보임', '~한 것으로 보임', '~태도가 나타남', '~으로 평가됨', '~이 관찰됨' 형태로 끝나게 하라. ` +
          `예: '중요성을 인식함' → '중요성을 인식하는 모습을 보임', '깊이 성찰함' → '깊이 성찰한 것으로 평가됨'. ` +
          `특히 다음 문장을 고쳐라: "${plain[0]}".`,
      });
    }
  }

  // 검증 11 — 활동 사이 접속 표현
  const connective = sentences.filter((s) => startsWithConnective(s));
  if (connective.length > 0) {
    issues.push({
      code: "connective_word",
      message: `활동을 잇는 접속 표현으로 시작하는 문장이 ${connective.length}개 있습니다.`,
      instruction:
        `'또한', '그리고', '더불어', '아울러', '한편', '이어서' 같은 접속 표현으로 문장을 시작하지 마라. ` +
        `다음 활동으로 넘어갈 때는 접속어 없이 활동명으로 바로 시작하라. ` +
        `특히 다음 문장을 고쳐라: "${connective[0]}".`,
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
