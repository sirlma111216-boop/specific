import "server-only";

import { badRequest } from "@/lib/api-error";
import {
  isChoiceType,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  resolveMinLength,
  validateForm,
  type FormQuestion,
  type QuestionType,
} from "./schema";

const TYPES: QuestionType[] = ["short", "long", "single", "multiple"];

/** 클라이언트가 보낸 양식을 신뢰하지 않고 서버에서 다시 만든다. */
export function sanitizeForm(raw: unknown): FormQuestion[] {
  if (!Array.isArray(raw)) throw badRequest("양식 형식이 올바르지 않습니다.");
  if (raw.length > MAX_QUESTIONS) {
    throw badRequest(`질문은 최대 ${MAX_QUESTIONS}개까지 만들 수 있습니다.`);
  }

  const questions: FormQuestion[] = raw.map((item, i) => {
    const q = (item ?? {}) as Partial<FormQuestion>;
    const type = TYPES.includes(q.type as QuestionType) ? (q.type as QuestionType) : "long";
    const id = String(q.id ?? "").trim() || `q${i + 1}`;
    const options = isChoiceType(type)
      ? (Array.isArray(q.options) ? q.options : [])
          .map((o) => String(o).trim())
          .filter(Boolean)
          .slice(0, MAX_OPTIONS)
      : [];
    return {
      id,
      type,
      label: String(q.label ?? "").trim(),
      required: Boolean(q.required),
      options,
      minLength: resolveMinLength({ type, minLength: Number(q.minLength) }),
    };
  });

  const errors = validateForm(questions);
  if (errors.length > 0) throw badRequest(errors.join("\n"), "form_invalid");
  return questions;
}

