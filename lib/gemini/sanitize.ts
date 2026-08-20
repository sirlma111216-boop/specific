import type { Category, SelectionMode } from "@/lib/types";
import type { GeminiEventPayload, GeminiRequestPayload } from "./payload-types";

const FORBIDDEN_KEYS = new Set([
  "name",
  "studentName",
  "studentNameNorm",
  "email",
  "uid",
  "studentId",
  "studentUid",
  "studentNumber",
  "rosterId",
  "classId",
  "teacherId",
  "teacherName",
  "schoolName",
  "grade",
  "classNumber",
]);

/** 이름/학교명 등 알고 있는 식별자가 본문 안에 섞여 있으면 가린다. */
export function redactKnownIdentifiers(text: string, identifiers: string[]): string {
  let out = text ?? "";
  for (const id of identifiers) {
    const trimmed = (id ?? "").trim();
    if (trimmed.length < 2) continue; // 한 글자는 오탐이 너무 많다
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), "○○");
  }
  return out;
}

/** 객체 트리에서 금지 키를 재귀적으로 제거한다(방어적 2차 필터). */
function stripForbiddenKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripForbiddenKeys(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      out[k] = stripForbiddenKeys(v);
    }
    return out as T;
  }
  return value;
}

export interface SanitizeInput {
  category: Category;
  targetLength: number;
  selectionMode: SelectionMode;
  events: Array<{
    title: string;
    description: string;
    eventDate: string;
    studentReflection: string;
    hasStudentReflection: boolean;
    teacherSelectionOrder: number;
  }>;
  /** 이미 기재요령 형식으로 완성된 임원 재임 표기 */
  officerTerms?: string[];
  /** 본문에서 가려야 할 실명·학교명·교사명 등 */
  identifiersToRedact: string[];
}

/**
 * Gemini 호출 직전에 반드시 통과해야 하는 개인정보 제거 단계.
 * 1) 허용된 필드만 새 객체로 옮긴다 (allowlist)
 * 2) 본문 안에 남아 있을 수 있는 실명·학교명을 가린다
 * 3) 금지 키를 재귀 제거한다
 * 4) 직렬화 결과에 식별자가 남아 있으면 예외를 던져 호출을 막는다 (fail-closed)
 */
export function sanitizeRecordGenerationPayload(input: SanitizeInput): GeminiRequestPayload {
  const identifiers = input.identifiersToRedact.filter((s) => (s ?? "").trim().length >= 2);

  const events: GeminiEventPayload[] = input.events.map((e) => ({
    title: redactKnownIdentifiers(e.title, identifiers),
    description: redactKnownIdentifiers(e.description, identifiers),
    eventDate: e.eventDate,
    studentReflection: redactKnownIdentifiers(e.studentReflection ?? "", identifiers),
    hasStudentReflection: e.hasStudentReflection,
    teacherSelectionOrder: e.teacherSelectionOrder,
  }));

  const payload: GeminiRequestPayload = stripForbiddenKeys({
    category: input.category,
    targetLength: input.targetLength,
    selectionMode: input.selectionMode,
    events,
    // 임원 표기에도 혹시 모를 식별자가 섞이지 않게 같은 마스킹을 통과시킨다.
    officerTerms: (input.officerTerms ?? []).map((t) => redactKnownIdentifiers(t, identifiers)),
  });

  assertNoPersonalInfo(payload, identifiers);
  return payload;
}

/** payload 직렬화 결과에 식별자나 금지 키가 남아 있는지 최종 확인한다. */
export function assertNoPersonalInfo(payload: unknown, identifiers: string[]): void {
  const json = JSON.stringify(payload);
  for (const key of FORBIDDEN_KEYS) {
    if (json.includes(`"${key}":`)) {
      throw new Error(`개인정보 필드(${key})가 AI 요청에 남아 있어 호출을 중단했습니다.`);
    }
  }
  for (const id of identifiers) {
    const trimmed = (id ?? "").trim();
    if (trimmed.length < 2) continue;
    if (json.includes(trimmed)) {
      throw new Error("개인 식별 정보가 AI 요청에 남아 있어 호출을 중단했습니다.");
    }
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(json)) {
    throw new Error("이메일 형식의 문자열이 AI 요청에 포함되어 호출을 중단했습니다.");
  }
}
