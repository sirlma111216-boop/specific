"use client";

import { Input, Textarea } from "@/components/ui/field";
import {
  isSingleFreeText,
  MAX_ANSWER_LENGTH,
  type FormAnswers,
  type FormQuestion,
} from "@/lib/forms/schema";
import { countCharacters } from "@/lib/utils";

/**
 * 관리자가 만든 양식을 학생 화면에 그린다.
 * 자유 서술 한 칸일 때는 질문 문구를 따로 띄우지 않는다. (안내문이 이미 위에 있다)
 */
export function FormAnswerFields({
  questions,
  answers,
  errors,
  onChange,
}: {
  questions: FormQuestion[];
  answers: FormAnswers;
  errors: Record<string, string>;
  onChange: (questionId: string, value: string | string[]) => void;
}) {
  const bare = isSingleFreeText(questions);

  return (
    <div className="space-y-6">
      {questions.map((q, i) => {
        const value = answers[q.id];
        const error = errors[q.id];

        return (
          <div key={q.id}>
            {!bare && (
              <p className="prose-ko mb-2 text-[15px] font-medium text-ink">
                {i + 1}. {q.label}
                {q.required && <span className="ml-1 text-coral">*</span>}
              </p>
            )}

            {q.type === "long" && (
              <>
                <Textarea
                  rows={bare ? 12 : 5}
                  value={String(value ?? "")}
                  onChange={(e) => onChange(q.id, e.target.value)}
                  maxLength={MAX_ANSWER_LENGTH}
                  placeholder={bare ? q.label : "자유롭게 작성하세요"}
                  aria-label={q.label}
                  className="text-[16px]"
                />
                <p className="mt-1 text-right text-[13px] text-muted">
                  {countCharacters(String(value ?? ""))} / {MAX_ANSWER_LENGTH}자
                </p>
              </>
            )}

            {q.type === "short" && (
              <Input
                value={String(value ?? "")}
                onChange={(e) => onChange(q.id, e.target.value)}
                placeholder="한 줄로 답해주세요"
                aria-label={q.label}
                className="text-[16px]"
              />
            )}

            {q.type === "single" && (
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border border-hairline px-4 py-3"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={value === opt}
                      onChange={() => onChange(q.id, opt)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#181d26]"
                    />
                    <span className="prose-ko text-[15px] text-body">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {q.type === "multiple" && (
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const picked = Array.isArray(value) ? value : [];
                  const checked = picked.includes(opt);
                  return (
                    <label
                      key={opt}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-hairline px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onChange(
                            q.id,
                            checked ? picked.filter((p) => p !== opt) : [...picked, opt],
                          )
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#181d26]"
                      />
                      <span className="prose-ko text-[15px] text-body">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {error && <p className="mt-1.5 text-[13px] text-coral">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
