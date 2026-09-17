"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, Card } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  defaultMinLength,
  isChoiceType,
  MAX_MIN_LENGTH,
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
    minLength: defaultMinLength("long"),
  };
}

/** 문항 카드 위 도구 버튼. 글자가 세로로 접히지 않게 폭을 고정하고 테두리로 구분한다. */
function ToolButton({
  children,
  onClick,
  disabled,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1 rounded-sm border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-35",
        tone === "danger"
          ? "border-hairline bg-canvas text-coral active:bg-surface-soft"
          : "border-hairline bg-canvas text-body active:bg-surface-soft",
      )}
    >
      {children}
    </button>
  );
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
        return {
          ...q,
          type,
          options: isChoiceType(type) ? options : [],
          minLength: defaultMinLength(type),
        };
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

  function remove(index: number) {
    const q = questions[index];
    if (q.label.trim() && !window.confirm(`${index + 1}번 질문을 삭제할까요?\n"${q.label.trim()}"`)) {
      return;
    }
    setQuestions((prev) => prev.filter((_, x) => x !== index));
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
            {/* 1행: 번호 · 유형 · 필수 / 도구 버튼. 좁은 화면에서는 도구가 아래 줄로 내려간다. */}
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Badge tone="muted">{i + 1}번</Badge>
              {/* 입력 부품은 w-full 이라 감싸서 폭을 정한다 */}
              <div className="w-[180px]">
                <Select
                  aria-label={`${i + 1}번 질문 유형`}
                  value={q.type}
                  onChange={(e) => changeType(i, e.target.value as QuestionType)}
                  className="h-9 text-[13px]"
                >
                  {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </div>

              <label
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border px-3 text-[13px] font-medium whitespace-nowrap select-none",
                  q.required
                    ? "border-ink bg-ink text-white"
                    : "border-hairline bg-canvas text-body",
                )}
              >
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  className="h-4 w-4 accent-white"
                />
                필수 응답
              </label>

              <div className="ml-auto flex items-center gap-1.5">
                <ToolButton onClick={() => move(i, -1)} disabled={i === 0} title="위로 옮기기">
                  <span aria-hidden>↑</span> 위로
                </ToolButton>
                <ToolButton
                  onClick={() => move(i, 1)}
                  disabled={i === questions.length - 1}
                  title="아래로 옮기기"
                >
                  <span aria-hidden>↓</span> 아래로
                </ToolButton>
                <ToolButton onClick={() => remove(i)} tone="danger" title="이 질문 삭제">
                  삭제
                </ToolButton>
              </div>
            </div>

            <Textarea
              rows={2}
              value={q.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="학생에게 물어볼 내용을 적어주세요"
              aria-label={`${i + 1}번 질문 내용`}
            />

            {!isChoiceType(q.type) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-body">
                <label htmlFor={`min-${q.id}`} className="whitespace-nowrap">
                  최소 글자 수
                </label>
                <div className="w-24">
                  <Input
                    id={`min-${q.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_MIN_LENGTH}
                    value={q.minLength ?? defaultMinLength(q.type)}
                    onChange={(e) =>
                      update(i, {
                        minLength: Math.min(
                          MAX_MIN_LENGTH,
                          Math.max(0, Math.round(Number(e.target.value) || 0)),
                        ),
                      })
                    }
                    className="h-9 text-[13px]"
                  />
                </div>
                <span className="text-muted">
                  자 이상 써야 제출됩니다. 0이면 제한 없음.
                  {q.type === "long" && ` 서술형 기본값은 ${defaultMinLength("long")}자입니다.`}
                </span>
              </div>
            )}

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
                    <ToolButton
                      onClick={() => update(i, { options: q.options.filter((_, x) => x !== oi) })}
                      title="선택지 삭제"
                    >
                      ✕
                    </ToolButton>
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
