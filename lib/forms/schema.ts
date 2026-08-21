/**
 * 관리자가 만드는 활동 응답 양식.
 *
 * 구글 폼처럼 질문을 여러 개 두고, 학생이 답한 내용을 모아 생기부 생성 자료로 쓴다.
 * 질문을 따로 만들지 않으면 지금까지와 같은 자유 서술 한 칸이 기본으로 쓰인다.
 */

export type QuestionType = "short" | "long" | "single" | "multiple";

export interface FormQuestion {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  /** single / multiple 에서만 쓴다 */
  options: string[];
}

/** 주관식은 문자열, 객관식(복수)은 문자열 배열 */
export type AnswerValue = string | string[];
export type FormAnswers = Record<string, AnswerValue>;

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  short: "단답형",
  long: "서술형",
  single: "객관식 (하나 선택)",
  multiple: "객관식 (여러 개 선택)",
};

export const MAX_QUESTIONS = 15;
export const MAX_OPTIONS = 10;
export const MAX_ANSWER_LENGTH = 2000;

/** 기본 자유 서술 질문. 양식을 따로 만들지 않은 활동에 쓰인다. */
export const DEFAULT_QUESTION_ID = "reflection";
export const DEFAULT_QUESTION_LABEL =
  "오늘 활동에서 새롭게 알게 된 점, 기억에 남은 내용, 자신의 생각이나 앞으로 실천하고 싶은 점 등을 자유롭게 작성하세요.";

export function defaultForm(): FormQuestion[] {
  return [
    {
      id: DEFAULT_QUESTION_ID,
      type: "long",
      label: DEFAULT_QUESTION_LABEL,
      required: true,
      options: [],
    },
  ];
}

/** 저장된 값이 비었거나 깨져 있으면 기본 양식으로 되돌린다. */
export function resolveForm(raw: FormQuestion[] | undefined | null): FormQuestion[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultForm();
  return raw;
}

export function isChoiceType(type: QuestionType): boolean {
  return type === "single" || type === "multiple";
}

/**
 * 자유 서술 한 칸짜리 양식인가.
 * 이 경우 답변을 그대로 쓰면 되므로 질문 문구를 덧붙이지 않는다.
 */
export function isSingleFreeText(questions: FormQuestion[]): boolean {
  return questions.length === 1 && questions[0].type === "long";
}

/**
 * 답변을 생기부 생성·교사 확인용 평문으로 만든다.
 *
 * 자유 서술 한 칸이면 답변만 그대로 두고, 질문이 여러 개면
 * 어떤 질문에 대한 답인지 알 수 있게 질문을 함께 붙인다.
 */
export function flattenAnswers(questions: FormQuestion[], answers: FormAnswers): string {
  const resolved = resolveForm(questions);

  if (isSingleFreeText(resolved)) {
    return String(answers[resolved[0].id] ?? "").trim();
  }

  return resolved
    .map((q) => {
      const raw = answers[q.id];
      const value = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
      const trimmed = value.trim();
      if (!trimmed) return "";
      return `[${q.label}] ${trimmed}`;
    })
    .filter(Boolean)
    .join("\n");
}

export interface AnswerValidation {
  ok: boolean;
  /** questionId -> 오류 메시지 */
  errors: Record<string, string>;
}

/** 학생이 낸 답을 양식 기준으로 검사한다. 서버와 화면에서 같은 규칙을 쓴다. */
export function validateAnswers(
  questions: FormQuestion[],
  answers: FormAnswers,
): AnswerValidation {
  const resolved = resolveForm(questions);
  const errors: Record<string, string> = {};

  for (const q of resolved) {
    const raw = answers[q.id];

    if (isChoiceType(q.type)) {
      const picked = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
      const unknown = picked.filter((p) => !q.options.includes(p));
      if (unknown.length > 0) {
        errors[q.id] = "선택할 수 없는 항목입니다.";
        continue;
      }
      if (q.type === "single" && picked.length > 1) {
        errors[q.id] = "하나만 선택해주세요.";
        continue;
      }
      if (q.required && picked.length === 0) {
        errors[q.id] = "선택해주세요.";
      }
      continue;
    }

    const text = String(raw ?? "").trim();
    if (q.required && text === "") {
      errors[q.id] = "내용을 입력해주세요.";
      continue;
    }
    if (Array.from(text).length > MAX_ANSWER_LENGTH) {
      errors[q.id] = `${MAX_ANSWER_LENGTH}자 이내로 작성해주세요.`;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/** 답변에서 양식에 없는 질문 id를 걷어낸다. (임의 필드 저장 방지) */
export function pickKnownAnswers(
  questions: FormQuestion[],
  answers: FormAnswers,
): FormAnswers {
  const resolved = resolveForm(questions);
  const out: FormAnswers = {};
  for (const q of resolved) {
    const raw = answers[q.id];
    if (raw === undefined) continue;
    if (isChoiceType(q.type)) {
      const picked = (Array.isArray(raw) ? raw : [String(raw)])
        .map((v) => String(v))
        .filter((v) => q.options.includes(v));
      out[q.id] = q.type === "single" ? (picked[0] ?? "") : picked;
    } else {
      out[q.id] = String(raw ?? "").trim();
    }
  }
  return out;
}

/** 관리자가 저장한 양식을 검사한다. 잘못된 항목은 메시지로 알린다. */
export function validateForm(questions: FormQuestion[]): string[] {
  const errors: string[] = [];
  if (questions.length > MAX_QUESTIONS) {
    errors.push(`질문은 최대 ${MAX_QUESTIONS}개까지 만들 수 있습니다.`);
  }
  const seen = new Set<string>();
  questions.forEach((q, i) => {
    const at = `${i + 1}번 질문`;
    if (!q.id?.trim()) errors.push(`${at}: 내부 식별자가 없습니다.`);
    if (seen.has(q.id)) errors.push(`${at}: 질문이 중복됩니다.`);
    seen.add(q.id);
    if (!q.label?.trim()) errors.push(`${at}: 질문 내용을 입력해주세요.`);
    if (isChoiceType(q.type)) {
      const filled = q.options.map((o) => o.trim()).filter(Boolean);
      if (filled.length < 2) errors.push(`${at}: 선택지를 2개 이상 입력해주세요.`);
      if (filled.length > MAX_OPTIONS) {
        errors.push(`${at}: 선택지는 최대 ${MAX_OPTIONS}개입니다.`);
      }
      if (new Set(filled).size !== filled.length) {
        errors.push(`${at}: 선택지가 중복됩니다.`);
      }
    }
  });
  return errors;
}
