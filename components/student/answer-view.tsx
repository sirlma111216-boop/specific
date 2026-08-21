import { isSingleFreeText, resolveForm, type FormAnswers, type FormQuestion } from "@/lib/forms/schema";

/**
 * 학생이 낸 답변을 다시 보여준다.
 * 질문이 여러 개면 질문과 답을 짝지어 보여주고, 자유 서술 한 칸이면 글만 보여준다.
 */
export function AnswerView({
  form,
  answers,
  fallback,
  emptyText,
}: {
  form: FormQuestion[];
  answers: FormAnswers | null;
  /** 예전 방식으로 저장된 평문 (answers가 없을 때 사용) */
  fallback: string | null;
  emptyText: string;
}) {
  const questions = resolveForm(form);

  if (!answers || Object.keys(answers).length === 0) {
    return <p className="prose-ko text-[14px] text-body">{fallback ?? emptyText}</p>;
  }

  if (isSingleFreeText(questions)) {
    const only = String(answers[questions[0].id] ?? "").trim();
    return <p className="prose-ko text-[14px] text-body">{only || fallback || emptyText}</p>;
  }

  const filled = questions
    .map((q) => {
      const raw = answers[q.id];
      const value = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
      return { q, value: value.trim() };
    })
    .filter((x) => x.value !== "");

  if (filled.length === 0) {
    return <p className="prose-ko text-[14px] text-body">{fallback ?? emptyText}</p>;
  }

  return (
    <dl className="space-y-3">
      {filled.map(({ q, value }) => (
        <div key={q.id}>
          <dt className="prose-ko text-[13px] text-muted">{q.label}</dt>
          <dd className="prose-ko mt-0.5 text-[14px] text-body">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
