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
  const [notice, setNotice] = useState<string | null>(null);
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
    const who = `${item.studentNumber}번 ${item.studentName}`;
    const records = item.autonomousCount + item.careerCount;

    // 되돌릴 수 없고 계정·기록까지 함께 사라지므로 무엇이 지워지는지 분명히 알린다.
    const lines = [`${who} 학생을 명단에서 뺍니다.`, ""];
    if (item.signupStatus === "linked") lines.push("· 학생 계정이 삭제되어 더 이상 로그인할 수 없습니다.");
    if (records > 0) lines.push(`· 활동 기록 ${records}건과 저장된 특기사항이 함께 삭제됩니다.`);
    lines.push("· 되돌릴 수 없습니다.", "");
    if (records > 0) lines.push("생기부에 반영할 내용이 있다면 먼저 복사해 두세요.", "");
    lines.push("계속할까요?");

    if (!window.confirm(lines.join("\n"))) return;

    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{ removedAccount: boolean; deletedResponses: number }>(
        `/api/teacher/roster?rosterId=${encodeURIComponent(item.rosterId)}`,
        { method: "DELETE" },
      );
      setNotice(
        res.removedAccount
          ? `${who} 학생을 명단에서 뺐습니다. 계정과 기록도 함께 정리했습니다.`
          : `${who} 학생을 명단에서 뺐습니다.`,
      );
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
      {notice && <Alert tone="success">{notice}</Alert>}

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
                    <button
                      type="button"
                      onClick={() => removeStudent(s)}
                      className="text-[13px] text-muted"
                    >
                      삭제
                    </button>
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
