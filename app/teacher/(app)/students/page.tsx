"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { emptyRows, RosterEditor, type RosterRow } from "@/components/roster/roster-editor";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { StudentListItem } from "@/lib/types";

interface StudentsResponse {
  students: StudentListItem[];
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [rows, setRows] = useState<RosterRow[]>(emptyRows(1));
  const [busy, setBusy] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<StudentsResponse>("/api/teacher/students");
        if (!alive) return;
        setStudents(data.students);
        setError(null);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  async function addStudents() {
    setBusy(true);
    setError(null);
    try {
      const payload = rows
        .filter((r) => r.studentName.trim() !== "" || r.studentNumber.trim() !== "")
        .map((r) => ({ studentNumber: r.studentNumber, studentName: r.studentName }));
      await apiFetch("/api/teacher/roster", {
        method: "POST",
        body: JSON.stringify({ students: payload }),
      });
      setRows(emptyRows(1));
      setAdding(false);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(item: StudentListItem) {
    if (!window.confirm(`${item.studentNumber}번 ${item.studentName} 학생을 명단에서 뺄까요?`)) return;
    try {
      await apiFetch(`/api/teacher/roster?rosterId=${encodeURIComponent(item.rosterId)}`, {
        method: "DELETE",
      });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <main>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-[1.2] text-ink">학급 학생</h1>
          <p className="mt-2 text-[14px] text-muted">
            학생 이름을 누르면 활동 기록과 특기사항 작성 화면으로 이동합니다.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "닫기" : "학생 추가"}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {adding && (
        <Card className="mb-8">
          <h2 className="mb-4 text-[18px] font-medium text-ink">학생 추가</h2>
          <RosterEditor rows={rows} onChange={setRows} />
          <div className="mt-5 flex gap-3">
            <Button size="sm" loading={busy} onClick={addStudents}>
              추가하기
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
              취소
            </Button>
          </div>
        </Card>
      )}

      {!students && !error && <Spinner />}

      {students && (
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="w-20 px-4 py-3 text-left font-medium">번호</th>
                <th className="px-4 py-3 text-left font-medium">이름</th>
                <th className="w-28 px-4 py-3 text-left font-medium">가입</th>
                <th className="w-24 px-4 py-3 text-left font-medium">자율 기록</th>
                <th className="w-24 px-4 py-3 text-left font-medium">진로 기록</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.rosterId} className="border-t border-hairline">
                  <td className="px-4 py-3 text-muted">{s.studentNumber}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/teacher/students/${s.rosterId}`}
                      className="text-ink underline underline-offset-2"
                    >
                      {s.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {s.signupStatus === "linked" ? (
                      <Badge tone="success">가입 완료</Badge>
                    ) : (
                      <Badge tone="muted">미가입</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-body">{s.autonomousCount}</td>
                  <td className="px-4 py-3 text-body">{s.careerCount}</td>
                  <td className="px-4 py-3 text-right">
                    {s.signupStatus === "pending" && (
                      <button
                        type="button"
                        onClick={() => removeStudent(s)}
                        className="text-[13px] text-muted"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    등록된 학생이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
