import "server-only";

import { generateText } from "@/lib/gemini/client";
import { loadRecordExamples } from "@/lib/gemini/examples";
import { buildRepairPrompt, buildSystemInstruction, buildUserPrompt } from "@/lib/gemini/prompt";
import { sanitizeRecordGenerationPayload } from "@/lib/gemini/sanitize";
import type { GeminiRequestPayload } from "@/lib/gemini/payload-types";
import {
  buildRepairInstruction,
  validateRecordDraft,
  type ValidationIssue,
} from "@/lib/record-validator/validate";
import { countCharacters, formatRecordDate } from "@/lib/utils";
import type { Category, SelectionMode } from "@/lib/types";
import type { OfficerTermForRecord } from "@/lib/roster/officer";
import { selectEventsForGeneration, type SelectableEvent } from "./select";

/** 담임이 '기록 불러오기'로 체크한 개인 활동 1건 */
export interface SelectablePersonalActivity {
  activityId: string;
  title: string;
  /** 기재요령 표기. 하루면 "2026.03.05.", 기간이면 "2026.03.05.-2026.03.07." */
  period: string;
  content: string;
}

/** Gemini 재수정 호출 최대 횟수. 무한 재시도를 하지 않는다. */
export const MAX_REPAIR_ATTEMPTS = 1;

export interface GenerateRecordInput {
  category: Category;
  targetLength: number;
  selectionMode: SelectionMode;
  events: SelectableEvent[];
  /** 기재요령 형식 임원 표기 + 담임이 적은 한 줄 리더십 메모 */
  officerTerms?: OfficerTermForRecord[];
  /** 담당 교사가 따로 남긴 개인 활동 중 담임이 체크한 것 */
  personalActivities?: SelectablePersonalActivity[];
  /** 본문에서 가려야 할 실명·학교명·교사명 등 (Gemini로 나가기 전 제거) */
  identifiersToRedact: string[];
}

export interface GenerateRecordOutput {
  text: string;
  characterCount: number;
  usedEventIds: string[];
  usedEventTitles: string[];
  /** 마지막 검증에서도 남은 문제(교사에게 안내만 한다) */
  remainingIssues: ValidationIssue[];
  repairAttempts: number;
  /** 실제로 Gemini에 보낸 payload — 개인정보 제거 결과 확인용 */
  sanitizedPayload: GeminiRequestPayload;
}

/* 한자 범위. 리터럴로 적으면 파일 저장 과정에서 호환한자(U+F900)가 일반한자로
   정규화되어 범위가 한글까지 삼킨 적이 있다. 반드시 코드포인트로 적을 것. */
const HANJA_CLASS = "\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF";
/** "진로적성검사(適性檢査)"처럼 한자만 든 괄호. 활동명에 섞여 들어온다. */
const HANJA_PAREN = new RegExp(`[(（]\\s*[${HANJA_CLASS}\\s·,]+\\s*[)）]`, "gu");
/** 전각 영문·숫자·기호(U+FF01~U+FF5E)는 ASCII로 그대로 대응된다. */
const FULLWIDTH_ASCII = new RegExp("[\\uFF01-\\uFF5E]", "gu");

/**
 * 모델이 가끔 붙이는 따옴표/머리말/목록 기호를 떼어내고,
 * 확실하게 되돌릴 수 있는 비한글 문자를 한글 표기로 정리한다.
 *
 * 한자를 무턱대고 지우면 뜻이 사라지므로, 여기서는 지워도 뜻이 남는 경우
 * (한자만 든 괄호, ASCII로 1:1 대응되는 전각문자)만 다룬다.
 * 그래도 남은 한자는 검증 9가 잡아 재생성을 요청한다.
 */
export function cleanDraft(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  text = text.replace(/^(특기사항|초안|결과)\s*[:：]\s*/, "");
  text = text.replace(/^["'“”『「]+/, "").replace(/["'“”』」]+$/, "");
  text = text.replace(/^[-•*]\s+/gm, "");
  // 전각 → ASCII (？ ！ （ ） ０-９ Ａ-Ｚ 등)
  text = text.replace(FULLWIDTH_ASCII, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  text = text.replace(/　/g, " ");
  // 한자만 든 괄호는 통째로 뺀다. "진로적성검사(適性檢査)(2026.03.20.)" → "진로적성검사(2026.03.20.)"
  text = text.replace(HANJA_PAREN, "");
  text = text.replace(/\s+([,.)])/g, "$1");
  return text.replace(/[ \t]+\n/g, "\n").trim();
}

/**
 * 활동 선택 → 개인정보 제거 → Gemini 생성 → 서버 재검증 → (필요 시) 1회 수정 생성.
 */
export async function generateStudentRecord(
  input: GenerateRecordInput,
): Promise<GenerateRecordOutput> {
  const officerTerms = input.officerTerms ?? [];
  const personalActivities = input.personalActivities ?? [];

  // 임원·개인 활동이 이미 분량을 차지하므로 그만큼 활동을 덜 고른다.
  const used = selectEventsForGeneration(input.events, {
    mode: input.selectionMode,
    targetLength: input.targetLength,
    reservedItems: officerTerms.length + personalActivities.length,
  });

  const payload = sanitizeRecordGenerationPayload({
    category: input.category,
    targetLength: input.targetLength,
    selectionMode: input.selectionMode,
    events: used.map((e) => ({
      title: e.title,
      description: e.description,
      // 결과에 그대로 쓰일 표기(2026.08.19.)로 넘긴다. 모델이 날짜를 변환하다
      // 형식을 틀리는 일을 막기 위해 미리 맞춰서 보낸다.
      eventDate: formatRecordDate(e.eventDate),
      studentReflection: e.studentReflection,
      hasStudentReflection: e.hasStudentReflection,
      teacherSelectionOrder: e.teacherSelectionOrder,
    })),
    officerTerms,
    personalActivities: personalActivities.map((a) => ({
      title: a.title,
      activityDate: a.period,
      content: a.content,
    })),
    identifiersToRedact: input.identifiersToRedact,
  });

  const examples = loadRecordExamples();
  const systemInstruction = buildSystemInstruction(input.category, examples.text);

  let text = cleanDraft(
    await generateText({ systemInstruction, userPrompt: buildUserPrompt(payload) }),
  );

  const validationEvents = payload.events.map((e) => ({
    title: e.title,
    hasStudentReflection: e.hasStudentReflection,
    studentReflection: e.studentReflection,
    eventDate: e.eventDate,
  }));
  const validationPersonal = payload.personalActivities.map((a) => ({
    title: a.title,
    activityDate: a.activityDate,
    content: a.content,
  }));
  const officerLabels = payload.officerTerms.map((o) => o.term);
  const officerNotes = payload.officerTerms.map((o) => o.leadership);

  let result = validateRecordDraft({
    text,
    targetLength: input.targetLength,
    events: validationEvents,
    officerTerms: officerLabels,
    officerNotes,
    personalActivities: validationPersonal,
  });

  let attempts = 0;
  while (!result.ok && attempts < MAX_REPAIR_ATTEMPTS) {
    attempts += 1;
    const instruction = buildRepairInstruction(result.issues, input.targetLength);
    const repaired = cleanDraft(
      await generateText({
        systemInstruction,
        userPrompt: buildRepairPrompt(payload, text, instruction),
        temperature: 0.6,
      }),
    );
    const repairedResult = validateRecordDraft({
      text: repaired,
      targetLength: input.targetLength,
      events: validationEvents,
      officerTerms: officerLabels,
      officerNotes,
      personalActivities: validationPersonal,
    });
    // 수정본이 더 나빠지면 원본을 유지한다.
    if (repairedResult.issues.length <= result.issues.length) {
      text = repaired;
      result = repairedResult;
    }
  }

  return {
    text,
    characterCount: countCharacters(text),
    usedEventIds: used.map((e) => e.eventId),
    usedEventTitles: used.map((e) => e.title),
    remainingIssues: result.issues,
    repairAttempts: attempts,
    sanitizedPayload: payload,
  };
}
