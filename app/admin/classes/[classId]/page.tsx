"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { emptyRows, RosterEditor, type RosterRow } from "@/components/roster/roster-editor";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { ClassDoc, SignupStatus } from "@/lib/types";
import { formatClassFull } from "@/lib/utils";

interface RosterRowView {
  rosterId: string;
  studentNumber: number;
  studentName: string;
  signupStatus: SignupStatus;
  linkedUserId: string | null;
  email: string | null;
  autonomousCount: number;
  careerCount: number;
}

interface Detail {
  klass: ClassDoc;
  teacher: { uid: string; email: string; teacherName: string; classId: string | null } | null;
  roster: RosterRowView[];
}

export default function AdminClassDetailPage() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((n) => n + 1);

  // 학급 정보 편집
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ schoolYear: "", grade: "", classNumber: "", teacherName: "", isTest: false });
  const [busy, setBusy] = useState(false);

  // 학생 추가
  const [adding, setAdding] = useState(false);
  const [rows, setRows] = useState<RosterRow[]>(emptyRows(1));

  // 명단 행 편집
  const [editRow, setEditRow] = useState<{ rosterId: string; studentNumber: string; studentName: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<Detail>(`/api/admin/classes/${classId}`);
        if (!alive) return;
        setData(res);
        setForm({
          schoolYear: String(res.klass.schoolYear),
          grade: res.klass.grade,
          classNumber: res.klass.classNumber,
          teacherName: res.klass.teacherName,
          isTest: Boolean(res.klass.isTest),
        });
        setError(null);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId, reloadToken]);

  async function run(fn: () => Promise<string | void>) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const { klass, teacher, roster } = data;
  const label = formatClassFull(klass.schoolYear, klass.grade, klass.classNumber);
  const linked = roster.filter((r) => r.signupStatus === "linked").length;

  return (
    <main>
      <Link href="/admin/classes" className="mb-6 inline-block text-[13px] text-muted">
        ← 학급
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] leading-[1.2] text-ink">{label}</h1>
            {klass.isTest && <Badge tone="coral">테스트 학급</Badge>}
          </div>
          <p className="mt-2 text-[14px] text-muted">
            담임 {klass.teacherName} · 명단 {roster.length}명 · 가입 {linked}명
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? "편집 닫기" : "학급 정보 편집"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
            {adding ? "닫기" : "학생 추가"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              const lines = [
                `${label} 학급을 삭제합니다.`,
                "",
                `· 명단 ${roster.length}명과 그 학생들의 계정·소감·기록·특기사항이 모두 삭제됩니다.`,
                "· 담임 계정은 남고 학급 연결만 풀립니다.",
                "· 되돌릴 수 없습니다.",
                "",
                "정말 삭제할까요?",
              ];
              if (!window.confirm(lines.join("\n"))) return;
              if (!window.confirm("마지막 확인입니다. 학급과 학생 자료를 전부 지울까요?")) return;
              run(async () => {
                await apiFetch(`/api/admin/classes/${classId}`, { method: "DELETE" });
                router.replace("/admin/classes");
              });
            }}
          >
            학급 삭제
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {editing && (
        <Card className="mb-6">
          <h2 className="mb-4 text-[18px] font-medium text-ink">학급 정보 편집</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await apiFetch(`/api/admin/classes/${classId}`, {
                  method: "PATCH",
                  body: JSON.stringify(form),
                });
                setEditing(false);
                return "학급 정보를 저장했습니다.";
              });
            }}
          >
            <div className="grid gap-x-4 sm:grid-cols-4">
              <Field label="학년도" htmlFor="schoolYear">
                <Input id="schoolYear" inputMode="numeric" value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })} />
              </Field>
              <Field label="학년" htmlFor="grade">
                <Input id="grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
              </Field>
              <Field label="반" htmlFor="classNumber">
                <Input id="classNumber" value={form.classNumber} onChange={(e) => setForm({ ...form, classNumber: e.target.value })} />
              </Field>
              <Field label="담임교사 이름" htmlFor="teacherName">
                <Input id="teacherName" value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} />
              </Field>
            </div>
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-[14px] text-body">
              <input
                type="checkbox"
                checked={form.isTest}
                onChange={(e) => setForm({ ...form, isTest: e.target.checked })}
                className="h-4 w-4 accent-[#181d26]"
              />
              연수용 테스트 학급 (테스트 활동만 보이고, 학생 가입 목록에 나오지 않음)
            </label>
            <Button type="submit" size="sm" loading={busy}>
              저장
            </Button>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 text-[18px] font-medium text-ink">담임 계정</h2>
        {teacher ? (
          <div className="flex flex-wrap items-center gap-3 text-[14px]">
            <span className="text-ink">{teacher.email}</span>
            <span className="text-muted">{teacher.teacherName}</span>
            {teacher.classId === classId ? (
              <Badge tone="success">연결됨</Badge>
            ) : (
              <Badge tone="coral">이 계정은 다른 학급을 가리킴</Badge>
            )}
            <Link href={`/admin/accounts?q=${encodeURIComponent(teacher.email)}`} className="text-link underline underline-offset-2">
              계정 관리
            </Link>
          </div>
        ) : (
          <p className="text-[14px] text-coral">
            담임 계정이 없습니다.{" "}
            <Link href="/admin/accounts" className="text-link underline underline-offset-2">
              계정 화면
            </Link>
            에서 교사 계정을 만들거나 기존 교사를 이 학급에 배정하세요.
          </p>
        )}
      </Card>

      {adding && (
        <Card className="mb-6">
          <h2 className="mb-4 text-[18px] font-medium text-ink">학생 추가</h2>
          <RosterEditor rows={rows} onChange={setRows} />
          <div className="mt-5 flex gap-3">
            <Button
              size="sm"
              loading={busy}
              onClick={() =>
                run(async () => {
                  const students = rows
                    .filter((r) => r.studentName.trim() !== "" || r.studentNumber.trim() !== "")
                    .map((r) => ({ studentNumber: r.studentNumber, studentName: r.studentName }));
                  const res = await apiFetch<{ added: number }>(`/api/admin/classes/${classId}/roster`, {
                    method: "POST",
                    body: JSON.stringify({ students }),
                  });
                  setRows(emptyRows(1));
                  setAdding(false);
                  return `학생 ${res.added}명을 추가했습니다.`;
                })
              }
            >
              추가하기
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(false)}>
              취소
            </Button>
          </div>
        </Card>
      )}

      <h2 className="mb-3 text-[18px] font-medium text-ink">학생 명단</h2>
      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full min-w-[760px] text-[14px]">
          <thead className="bg-surface-soft text-muted">
            <tr>
              <th className="w-16 px-4 py-3 text-left font-medium">번호</th>
              <th className="px-4 py-3 text-left font-medium">이름</th>
              <th className="px-4 py-3 text-left font-medium">가입 계정</th>
              <th className="w-20 px-4 py-3 text-left font-medium">자율</th>
              <th className="w-20 px-4 py-3 text-left font-medium">진로</th>
              <th className="w-44 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.rosterId} className="border-t border-hairline">
                {editRow?.rosterId === r.rosterId ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        value={editRow.studentNumber}
                        inputMode="numeric"
                        onChange={(e) => setEditRow({ ...editRow, studentNumber: e.target.value })}
                        className="h-9 w-16 text-[13px]"
                        aria-label="번호"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={editRow.studentName}
                        onChange={(e) => setEditRow({ ...editRow, studentName: e.target.value })}
                        className="h-9 w-40 text-[13px]"
                        aria-label="이름"
                      />
                    </td>
                    <td className="px-4 py-2 text-muted" colSpan={3}>
                      이름을 바꾸면 이후 가입 대조에 새 이름이 쓰입니다.
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          loading={busy}
                          onClick={() =>
                            run(async () => {
                              await apiFetch(`/api/admin/roster/${r.rosterId}`, {
                                method: "PATCH",
                                body: JSON.stringify(editRow),
                              });
                              setEditRow(null);
                              return "명단을 고쳤습니다.";
                            })
                          }
                        >
                          저장
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setEditRow(null)}>
                          취소
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-muted">{r.studentNumber}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/students/${r.rosterId}`} prefetch={false} className="text-ink underline underline-offset-2">
                        {r.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {r.signupStatus === "linked" ? (
                        <span className="text-body">{r.email ?? "(계정 문서 없음)"}</span>
                      ) : (
                        <Badge tone="muted">미가입</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body">{r.autonomousCount}</td>
                    <td className="px-4 py-3 text-body">{r.careerCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3 text-[13px]">
                        <button
                          type="button"
                          className="text-muted"
                          onClick={() =>
                            setEditRow({
                              rosterId: r.rosterId,
                              studentNumber: String(r.studentNumber),
                              studentName: r.studentName,
                            })
                          }
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="text-coral"
                          onClick={() => {
                            const lines = [`${r.studentNumber}번 ${r.studentName} 학생을 명단에서 뺍니다.`, ""];
                            if (r.signupStatus === "linked") lines.push("· 학생 계정이 삭제되어 더 이상 로그인할 수 없습니다.");
                            if (r.autonomousCount + r.careerCount > 0) lines.push(`· 활동 기록 ${r.autonomousCount + r.careerCount}건과 특기사항이 함께 삭제됩니다.`);
                            lines.push("· 되돌릴 수 없습니다.", "", "계속할까요?");
                            if (!window.confirm(lines.join("\n"))) return;
                            run(async () => {
                              await apiFetch(`/api/admin/roster/${r.rosterId}`, { method: "DELETE" });
                              return `${r.studentNumber}번 ${r.studentName} 학생을 뺐습니다.`;
                            });
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {roster.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  등록된 학생이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
