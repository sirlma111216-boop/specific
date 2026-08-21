"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { FormAnswerFields } from "@/components/student/form-answer";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { resolveForm, validateAnswers, type FormAnswers } from "@/lib/forms/schema";
import { CATEGORY_FULL_LABEL, type StudentEventItem } from "@/lib/types";
import { formatDateDots } from "@/lib/utils";

/**
 * 작성할 활동을 하나씩 순서대로 보여준다.
 * 목록은 부모가 이미 받아온 것을 넘겨받는다 — 화면마다 다시 조회하지 않기 위함.
 */
export function TodayWriter({ today, pending }: { today: string; pending: StudentEventItem[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedStep, setSavedStep] = useState(false);

  const total = pending.length;
  const event = pending[index];
  if (!event) return null;

  const questions = resolveForm(event.form);
  const isToday = event.eventDate === today;

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
      await apiFetch("/api/student/responses", {
        method: "POST",
        body: JSON.stringify({ eventId: event.eventId, answers }),
      });
      setSavedStep(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1);
      setAnswers({});
      setFieldErrors({});
      setSavedStep(false);
      setError(null);
      window.scrollTo({ top: 0 });
    } else {
      router.replace("/student/records");
    }
  }

  return (
    <main>
      {total > 1 && (
        <p className="mb-4 text-[14px] font-medium text-muted">
          {isToday ? "오늘 " : ""}작성할 활동 {index + 1} / {total}
        </p>
      )}

      <h1 className="text-[26px] leading-[1.3] text-ink">{event.title}</h1>
      <p className="mt-2 text-[14px] text-muted">
        {CATEGORY_FULL_LABEL[event.category]} · {formatDateDots(event.eventDate)}
      </p>

      {event.description && (
        <p className="prose-ko mt-5 rounded-md bg-surface-soft px-4 py-3 text-[14px] text-body">
          {event.description}
        </p>
      )}

      <p className="prose-ko mt-4 rounded-md bg-cream px-4 py-3 text-[14px] text-ink">
        {event.guidance}
      </p>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      {savedStep ? (
        <div className="mt-8">
          <Alert tone="success">기록을 저장했습니다.</Alert>
          <Button onClick={next} className="mt-4 w-full">
            {index + 1 < total ? "다음 활동 작성하기" : "내 기록 보기"}
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <FormAnswerFields
            questions={questions}
            answers={answers}
            errors={fieldErrors}
            onChange={setAnswer}
          />
          <Button onClick={save} loading={saving} className="mt-6 w-full">
            기록 저장하기
          </Button>
        </div>
      )}
    </main>
  );
}
