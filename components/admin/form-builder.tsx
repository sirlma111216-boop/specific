"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, Card } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  isChoiceType,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  QUESTION_TYPE_LABEL,
  resolveForm,
  validateForm,
  type FormQuestion,
  type QuestionType,
} from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

function newQuestion(index: number): FormQuestion {
  return {
    id: `q${Date.now().toString(36)}${index}`,
    type: "long",
    label: "",
    required: true,
    options: [],
  };
}

/** 관리자가 학생 응답 양식을 만드는 편집기. 구글 폼처럼 질문을 쌓아 올린다. */
export function FormBuilder({
  eventId,
  initial,
}: {
  eventId: string;
  initial: FormQuestion[];
}) {
  const [questions, setQuestions] = useState<FormQuestion[]>(resolveForm(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function update(index: number, patch: Partial<FormQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
    setNotice(null);
  }

  function changeType(index: number, type: QuestionType) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        // 객관식으로 바꾸면 빈 선택지 두 칸을 미리 만들어 준다.
        const options = isChoiceType(type) && q.options.length === 0 ? ["", ""] : q.options;
        return { ...q, type, options: isChoiceType(type) ? options : [] };
      }),
    );
    setNotice(null);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setNotice(null);
  }

  async function save() {
    const trimmed = questions.map((q) => ({
      ...q,
      label: q.label.trim(),
      options: q.options.map((o) => o.trim()).filter(Boolean),
    }));
    const problems = validateForm(trimmed);
    if (problems.length > 0) {
      setError(problems.join("\n"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ form: trimmed }),
      });
      setQuestions(trimmed);
      setNotice("양식을 저장했습니다.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="space-y-3">
        {questions.map((q, i) => (
          <Card key={q.id} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Badge tone="muted">{i + 1}번</Badge>
              <Select
                aria-label={`${i + 1}번 질문 유형`}
                value={q.type}
                onChange={(e) => changeType(i, e.target.value as QuestionType)}
                className="h-9 w-auto text-[13px]"
              >
                {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>

              <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-body">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  className="h-4 w-4 accent-[#181d26]"
                />
                필수
              </label>

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="px-2 py-1 text-[13px] text-muted disabled:opacity-30"
                  aria-label="위로"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === questions.length - 1}
                  className="px-2 py-1 text-[13px] text-muted disabled:opacity-30"
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setQuestions((prev) => prev.filter((_, x) => x !== i))}
                  className="px-2 py-1 text-[13px] text-muted"
                >
                  삭제
                </button>
              </div>
            </div>

            <Textarea
              rows={2}
              value={q.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="학생에게 물어볼 내용을 적어주세요"
              aria-label={`${i + 1}번 질문 내용`}
            />

            {isChoiceType(q.type) && (
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 border border-border-strong",
                        q.type === "single" ? "rounded-full" : "rounded-xs",
                      )}
                      aria-hidden
                    />
                    <Input
                      value={opt}
                      onChange={(e) =>
                        update(i, {
                          options: q.options.map((o, x) => (x === oi ? e.target.value : o)),
                        })
                      }
                      placeholder={`선택지 ${oi + 1}`}
                      className="h-9 text-[13px]"
                      aria-label={`${i + 1}번 질문 선택지 ${oi + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(i, { options: q.options.filter((_, x) => x !== oi) })
                      }
                      className="shrink-0 px-1 text-[13px] text-muted"
                      aria-label="선택지 삭제"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {q.options.length < MAX_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => update(i, { options: [...q.options, ""] })}
                    className="text-[13px] text-link underline underline-offset-2"
                  >
                    선택지 추가
                  </button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {questions.length < MAX_QUESTIONS && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQuestions((prev) => [...prev, newQuestion(prev.length)])}
          >
            질문 추가
          </Button>
        )}
        <Button size="sm" loading={saving} onClick={save}>
          양식 저장
        </Button>
      </div>

      <p className="mt-3 text-[13px] text-muted">
        질문을 모두 지우면 자유 서술 한 칸이 기본으로 쓰입니다. 이미 학생이 답한 뒤에 양식을 바꾸면
        이전 답변은 그대로 남고, 이후 응답부터 새 양식이 적용됩니다.
      </p>
    </div>
  );
}
