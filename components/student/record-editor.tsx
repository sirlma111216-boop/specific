"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { FormAnswerFields } from "@/components/student/form-answer";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  flattenAnswers,
  isSingleFreeText,
  resolveForm,
  validateAnswers,
  type FormAnswers,
  type FormQuestion,
} from "@/lib/forms/schema";
import type { StudentEventItem } from "@/lib/types";

export interface SavedRecord {
  answers: FormAnswers;
  content: string;
  updatedAt: number;
}

/** 이미 낸 답을 편집 칸에 채운다. 질문별 답이 없던 예전 기록은 자유 서술 칸에 원문을 넣는다. */
function initialAnswers(questions: FormQuestion[], item: StudentEventItem): FormAnswers {
  if (item.answers && Object.keys(item.answers).length > 0) return { ...item.answers };
  if (item.content && isSingleFreeText(questions)) return { [questions[0].id]: item.content };
  return {};
}

/**
 * 마감 전에 이미 낸 기록을 고치는 칸.
 * 처음 쓸 때와 같은 저장 API 를 쓰며, 마감됐는지는 서버가 다시 판정한다.
 * (편집하는 사이에 마감되면 서버가 거절하고 그 안내가 그대로 보인다)
 */
export function RecordEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: StudentEventItem;
  onSaved: (saved: SavedRecord) => void;
  onCancel: () => void;
}) {
  const questions = resolveForm(item.form);
  const [answers, setAnswers] = useState<FormAnswers>(() => initialAnswers(questions, item));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setAnswer(questionId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setFieldErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  async function save() {
    // 서버와 같은 규칙으로 먼저 확인해 즉시 알려준다.
    const check = validateAnswers(questions, answers);
    if (!check.ok) {
      setFieldErrors(check.errors);
      setError("답하지 않은 항목이 있습니다.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ updatedAt: number }>("/api/student/responses", {
        method: "POST",
        body: JSON.stringify({ eventId: item.eventId, answers }),
      });
      onSaved({ answers, content: flattenAnswers(questions, answers), updatedAt: res.updatedAt });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <Alert>{error}</Alert>}
      <FormAnswerFields
        questions={questions}
        answers={answers}
        errors={fieldErrors}
        onChange={setAnswer}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={save} loading={saving}>
          수정 저장
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
          취소
        </Button>
      </div>
    </div>
  );
}
