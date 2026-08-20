"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Alert, Badge, Card } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  formatOfficerTerm,
  isCompleteOfficerTerm,
  MAX_OFFICER_TERMS,
  OFFICER_PERIOD_LABEL,
  OFFICER_ROLE_LABEL,
  OFFICER_SCOPE_LABEL,
  type OfficerRole,
  type OfficerScope,
  type OfficerTerm,
  type OfficerTermPeriod,
} from "@/lib/roster/officer";

type DraftTerm = Partial<OfficerTerm>;

function emptyTerm(): DraftTerm {
  return { period: "first", scope: "class", role: "president", startDate: "", endDate: "" };
}

/**
 * 자치활동 임원 재임 입력.
 * 저장하면 자율·자치활동 특기사항의 첫 문장이 임원 활동으로 시작한다.
 */
export function OfficerEditor({
  rosterId,
  initial,
}: {
  rosterId: string;
  initial: OfficerTerm[];
}) {
  const [terms, setTerms] = useState<DraftTerm[]>(initial.length > 0 ? initial : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function update(index: number, patch: DraftTerm) {
    setTerms((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    setNotice(null);
  }

  async function save(next: DraftTerm[]) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/teacher/officer", {
        method: "POST",
        body: JSON.stringify({ rosterId, officerTerms: next }),
      });
      setNotice("임원 정보를 저장했습니다. 이제 생성하면 첫 문장에 들어갑니다.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const complete = terms.filter(isCompleteOfficerTerm);

  return (
    <Card className="mb-4 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[16px] font-medium text-ink">자치활동 임원</h2>
        {complete.length > 0 && <Badge tone="info">{complete.length}건</Badge>}
      </div>
      <p className="mb-4 text-[13px] leading-[1.6] text-muted">
        임원이면 특기사항 <strong className="text-ink">맨 앞</strong>에 리더십 내용이 들어갑니다.
        임원이 아니면 비워 두세요.
      </p>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {terms.length === 0 && (
        <p className="mb-3 rounded-sm bg-surface-soft px-3 py-2 text-[13px] text-muted">
          등록된 임원 이력이 없습니다.
        </p>
      )}

      <div className="space-y-4">
        {terms.map((term, i) => (
          <div key={i} className="rounded-md border border-hairline p-3">
            <div className="mb-2 grid grid-cols-3 gap-2">
              <Select
                aria-label="임기 구분"
                value={term.period ?? "first"}
                onChange={(e) => update(i, { period: e.target.value as OfficerTermPeriod })}
                className="h-9 text-[13px]"
              >
                {(Object.keys(OFFICER_PERIOD_LABEL) as OfficerTermPeriod[]).map((k) => (
                  <option key={k} value={k}>
                    {OFFICER_PERIOD_LABEL[k]}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="임원 구분"
                value={term.scope ?? "class"}
                onChange={(e) => update(i, { scope: e.target.value as OfficerScope })}
                className="h-9 text-[13px]"
              >
                {(Object.keys(OFFICER_SCOPE_LABEL) as OfficerScope[]).map((k) => (
                  <option key={k} value={k}>
                    {OFFICER_SCOPE_LABEL[k]}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="직책"
                value={term.role ?? "president"}
                onChange={(e) => update(i, { role: e.target.value as OfficerRole })}
                className="h-9 text-[13px]"
              >
                {(Object.keys(OFFICER_ROLE_LABEL) as OfficerRole[]).map((k) => (
                  <option key={k} value={k}>
                    {OFFICER_ROLE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label="재임 시작일"
                value={term.startDate ?? ""}
                onChange={(e) => update(i, { startDate: e.target.value })}
                className="h-9 text-[13px]"
              />
              <span className="shrink-0 text-[13px] text-muted">~</span>
              <Input
                type="date"
                aria-label="재임 종료일"
                value={term.endDate ?? ""}
                onChange={(e) => update(i, { endDate: e.target.value })}
                className="h-9 text-[13px]"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="prose-ko min-w-0 flex-1 text-[13px] text-body">
                {isCompleteOfficerTerm(term) ? formatOfficerTerm(term) : "날짜를 모두 입력해주세요"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = terms.filter((_, x) => x !== i);
                  setTerms(next);
                  void save(next);
                }}
                className="shrink-0 text-[13px] text-muted"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {terms.length < MAX_OFFICER_TERMS && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setTerms([...terms, emptyTerm()])}
          >
            임원 이력 추가
          </Button>
        )}
        {terms.length > 0 && (
          <Button size="sm" loading={saving} onClick={() => save(terms)}>
            임원 정보 저장
          </Button>
        )}
      </div>
    </Card>
  );
}
