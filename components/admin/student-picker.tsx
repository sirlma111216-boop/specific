"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export interface TreeStudent {
  rosterId: string;
  studentNumber: number;
  studentName: string;
  /** 로그인 아이디(이메일). 아직 가입하지 않았으면 null */
  email: string | null;
  signupStatus: "pending" | "linked";
}

export interface TreeClass {
  classId: string;
  grade: string;
  classNumber: string;
  label: string;
  teacherName: string;
  isTest: boolean;
  students: TreeStudent[];
}

export interface TreeGrade {
  grade: string;
  label: string;
  classes: TreeClass[];
}

/** 체크한 학생. 칩과 저장 요청에 쓸 만큼만 들고 있는다. */
export interface PickedStudent {
  rosterId: string;
  studentName: string;
  studentNumber: number;
  classLabel: string;
  isTest: boolean;
}

/** 검색 결과가 너무 많으면 화면이 길어지기만 한다. 좁혀 쓰도록 안내한다. */
const MAX_SEARCH_RESULTS = 50;

function matches(student: TreeStudent, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const name = student.studentName.replace(/\s+/g, "").toLowerCase();
  const email = (student.email ?? "").toLowerCase();
  return name.includes(q.replace(/\s+/g, "")) || email.includes(q);
}

/**
 * 학생 고르기 — 위쪽은 이름·아이디 검색, 아래쪽은 학년 → 반 → 학생 트리.
 *
 * 체크 상태는 부모가 들고 있어서, 검색어를 바꾸거나 트리를 접어도 그대로 남는다.
 * (여러 반에 흩어진 참여 학생을 한 번에 모으는 화면이라 이 성질이 핵심이다)
 */
export function StudentPicker({
  grades,
  picked,
  onToggle,
  onClear,
}: {
  grades: TreeGrade[];
  picked: Map<string, PickedStudent>;
  onToggle: (student: PickedStudent, checked: boolean) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openGrades, setOpenGrades] = useState<Set<string>>(new Set());
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const out: Array<{ student: TreeStudent; klass: TreeClass }> = [];
    for (const g of grades) {
      for (const k of g.classes) {
        for (const s of k.students) {
          if (matches(s, query)) out.push({ student: s, klass: k });
        }
      }
    }
    return out;
  }, [grades, query]);

  function toggleSet(set: Set<string>, key: string, apply: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  }

  function row(student: TreeStudent, klass: TreeClass, showClass: boolean) {
    const checked = picked.has(student.rosterId);
    const id = `pick-${student.rosterId}`;
    return (
      <label
        key={student.rosterId}
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[14px]",
          checked ? "bg-surface-soft" : "hover:bg-surface-soft",
        )}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) =>
            onToggle(
              {
                rosterId: student.rosterId,
                studentName: student.studentName,
                studentNumber: student.studentNumber,
                classLabel: klass.label,
                isTest: klass.isTest,
              },
              e.target.checked,
            )
          }
          className="h-4 w-4 shrink-0 accent-[#181d26]"
        />
        {showClass && <span className="shrink-0 text-[13px] text-muted">{klass.label}</span>}
        <span className="shrink-0 text-[13px] text-muted">{student.studentNumber}번</span>
        <span className="shrink-0 text-ink">{student.studentName}</span>
        {student.email ? (
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{student.email}</span>
        ) : (
          <span className="shrink-0 text-[12px] text-muted">미가입</span>
        )}
        {klass.isTest && <Badge tone="coral">테스트</Badge>}
      </label>
    );
  }

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름 또는 아이디로 찾기"
        aria-label="학생 검색"
      />

      {query.trim() ? (
        <div className="mt-3">
          <p className="mb-1 text-[13px] text-muted">
            검색 결과 {results.length}명
            {results.length > MAX_SEARCH_RESULTS && ` (앞에서 ${MAX_SEARCH_RESULTS}명만 표시)`}
          </p>
          <div className="max-h-[320px] overflow-auto">
            {results.slice(0, MAX_SEARCH_RESULTS).map(({ student, klass }) => row(student, klass, true))}
            {results.length === 0 && (
              <p className="px-2 py-6 text-center text-[14px] text-muted">찾는 학생이 없습니다.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 max-h-[420px] overflow-auto">
          {grades.map((g) => {
            const gradeOpen = openGrades.has(g.grade);
            return (
              <div key={g.grade} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSet(openGrades, g.grade, setOpenGrades)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[15px] text-ink hover:bg-surface-soft"
                >
                  <span className="w-4 shrink-0 text-center text-[14px] text-muted">
                    {gradeOpen ? "−" : "+"}
                  </span>
                  {g.label}
                  <span className="text-[13px] text-muted">
                    {g.classes.reduce((n, k) => n + k.students.length, 0)}명
                  </span>
                </button>

                {gradeOpen && (
                  <div className="ml-4">
                    {g.classes.map((k) => {
                      const classOpen = openClasses.has(k.classId);
                      const pickedHere = k.students.filter((s) => picked.has(s.rosterId)).length;
                      return (
                        <div key={k.classId}>
                          <button
                            type="button"
                            onClick={() => toggleSet(openClasses, k.classId, setOpenClasses)}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[14px] text-ink hover:bg-surface-soft"
                          >
                            <span className="w-4 shrink-0 text-center text-[14px] text-muted">
                              {classOpen ? "−" : "+"}
                            </span>
                            {k.label}
                            {k.isTest && <Badge tone="coral">테스트</Badge>}
                            <span className="text-[13px] text-muted">{k.students.length}명</span>
                            {pickedHere > 0 && <Badge tone="info">{pickedHere}명 선택</Badge>}
                          </button>

                          {classOpen && (
                            <div className="ml-6">
                              {k.students.map((s) => row(s, k, false))}
                              {k.students.length === 0 && (
                                <p className="px-2 py-2 text-[13px] text-muted">
                                  명단에 학생이 없습니다.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {grades.length === 0 && (
            <p className="px-2 py-6 text-center text-[14px] text-muted">등록된 학급이 없습니다.</p>
          )}
        </div>
      )}

      {/* 검색어를 바꿔도 여기 남는다. 지금까지 고른 학생을 한눈에 보고 빼기 위한 자리다. */}
      <div className="mt-4 border-t border-hairline pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[14px] font-medium text-ink">선택한 학생 {picked.size}명</span>
          {picked.size > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[13px] text-muted underline underline-offset-2"
            >
              전체 해제
            </button>
          )}
        </div>
        {picked.size === 0 ? (
          <p className="text-[13px] text-muted">아직 고른 학생이 없습니다.</p>
        ) : (
          <div className="flex max-h-[160px] flex-wrap gap-1.5 overflow-auto">
            {[...picked.values()].map((s) => (
              <button
                key={s.rosterId}
                type="button"
                onClick={() => onToggle(s, false)}
                title="빼기"
                className="inline-flex items-center gap-1 rounded-sm border border-hairline bg-surface-soft px-2 py-1 text-[12px] text-body"
              >
                {s.classLabel} {s.studentNumber}번 {s.studentName}
                <span aria-hidden className="text-muted">
                  ×
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
