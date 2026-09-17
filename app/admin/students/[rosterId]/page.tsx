"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { FormAnswers, FormQuestion } from "@/lib/forms/schema";
import { CATEGORY_LABEL, type Category, type EventStatus } from "@/lib/types";
import { formatClassFull, formatDateDots } from "@/lib/utils";

interface Detail {
  student: {
    rosterId: string;
    studentNumber: number;
    studentName: string;
    signupStatus: "pending" | "linked";
    autonomousCount: number;
    careerCount: number;
  };
  klass: { classId: string; schoolYear: number; grade: string; classNumber: string; teacherName: string; isTest: boolean } | null;
  account: { uid: string | null; email: string; createdAt: number } | null;
  events: Array<{
    eventId: string;
    category: Category;
    title: string;
    eventDate: string;
    status: EventStatus;
    form: FormQuestion[];
    response: { responseId: string; content: string; answers: FormAnswers | null; updatedAt: number } | null;
    note: { noteId: string; content: string; updatedAt: number } | null;
  }>;
  records: Array<{
    recordId: string;
    category: Category;
    editedText: string;
    generatedText: string;
    finalCharacterCount: number;
    updatedAt: number;
  }>;
}

function stamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminStudentPage() {
  const params = useParams<{ rosterId: string }>();
  const rosterId = params.rosterId;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyWritten, setOnlyWritten] = useState(true);
  const [editing, setEditing] = useState<{ responseId: string; content: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<Detail>(`/api/admin/students/${rosterId}`);
        if (alive) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [rosterId, reloadToken]);

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

  const { student, klass, account } = data;
  const events = data.events.filter((e) => !onlyWritten || e.response || e.note);

  return (
    <main>
      {klass && (
        <Link href={`/admin/classes/${klass.classId}`} className="mb-6 inline-block text-[13px] text-muted">
          ← {formatClassFull(klass.schoolYear, klass.grade, klass.classNumber)}
        </Link>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] leading-[1.2] text-ink">
              {student.studentNumber}번 {student.studentName}
            </h1>
            {student.signupStatus === "linked" ? <Badge tone="success">가입 완료</Badge> : <Badge tone="muted">미가입</Badge>}
            {klass?.isTest && <Badge tone="coral">테스트</Badge>}
          </div>
          <p className="mt-2 text-[14px] text-muted">
            {account ? `${account.email} · 가입 ${stamp(account.createdAt)}` : "연결된 계정 없음"} · 자율{" "}
            {student.autonomousCount} · 진로 {student.careerCount}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {account && (
            <Link
              href={`/admin/accounts?q=${encodeURIComponent(account.email)}`}
              className="inline-flex items-center rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-[14px] font-medium text-ink"
            >
              계정 관리
            </Link>
          )}
          <a
            href={`/print/student/${rosterId}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-[14px] font-medium text-ink"
          >
            <span aria-hidden>🖨</span> 누가기록 출력
          </a>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-medium text-ink">활동 기록</h2>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={onlyWritten} onChange={(e) => setOnlyWritten(e.target.checked)} className="h-4 w-4 accent-[#181d26]" />
          기록이 있는 활동만
        </label>
      </div>

      <div className="space-y-3">
        {events.map((e) => (
          <Card key={e.eventId} className="p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge tone={e.category === "autonomous" ? "info" : "neutral"}>{CATEGORY_LABEL[e.category]}</Badge>
              <span className="text-[16px] font-medium text-ink">{e.title}</span>
              <span className="text-[13px] text-muted">{formatDateDots(e.eventDate)}</span>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-[13px] font-medium text-muted">학생 원문</p>
              {e.response ? (
                editing?.responseId === e.response.responseId ? (
                  <div>
                    <Textarea rows={6} value={editing.content} onChange={(ev) => setEditing({ ...editing, content: ev.target.value })} />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        loading={busy}
                        onClick={() =>
                          run(async () => {
                            await apiFetch(`/api/admin/responses/${editing.responseId}`, {
                              method: "PATCH",
                              body: JSON.stringify({ content: editing.content }),
                            });
                            setEditing(null);
                            return "학생 원문을 고쳤습니다.";
                          })
                        }
                      >
                        저장
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="prose-ko rounded-md bg-surface-soft px-4 py-3 text-[14px] whitespace-pre-wrap text-body">{e.response.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
                      <span className="text-muted">{stamp(e.response.updatedAt)}</span>
                      <button type="button" className="text-muted underline underline-offset-2" onClick={() => setEditing({ responseId: e.response!.responseId, content: e.response!.content })}>
                        수정
                      </button>
                      <button
                        type="button"
                        className="text-coral underline underline-offset-2"
                        onClick={() => {
                          if (!window.confirm(`'${e.title}'에 대한 학생 원문을 삭제할까요?\n되돌릴 수 없습니다.`)) return;
                          run(async () => {
                            await apiFetch(`/api/admin/responses/${e.response!.responseId}`, { method: "DELETE" });
                            return "학생 원문을 삭제했습니다.";
                          });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-[14px] text-muted">작성하지 않음</p>
              )}
            </div>

            {e.note && (
              <div className="mt-4">
                <p className="mb-1 text-[13px] font-medium text-muted">교사 보완본</p>
                <p className="prose-ko rounded-md border border-hairline px-4 py-3 text-[14px] whitespace-pre-wrap text-body">{e.note.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="text-muted">{stamp(e.note.updatedAt)}</span>
                  <button
                    type="button"
                    className="text-coral underline underline-offset-2"
                    onClick={() => {
                      if (!window.confirm("교사 보완본을 삭제할까요? 학생 원문은 남습니다.")) return;
                      run(async () => {
                        await apiFetch(`/api/admin/notes/${e.note!.noteId}`, { method: "DELETE" });
                        return "교사 보완본을 삭제했습니다.";
                      });
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {events.length === 0 && (
          <Card className="py-10 text-center text-muted">
            {onlyWritten ? "기록이 있는 활동이 없습니다." : "활동이 없습니다."}
          </Card>
        )}
      </div>

      <h2 className="mt-10 mb-3 text-[18px] font-medium text-ink">저장된 특기사항</h2>
      <div className="space-y-3">
        {data.records.map((r) => (
          <Card key={r.recordId} className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={r.category === "autonomous" ? "info" : "neutral"}>{CATEGORY_LABEL[r.category]}</Badge>
              <span className="text-[13px] text-muted">
                {r.finalCharacterCount}자 · {stamp(r.updatedAt)}
              </span>
              <button
                type="button"
                className="ml-auto text-[13px] text-coral underline underline-offset-2"
                onClick={() => {
                  if (!window.confirm("저장된 특기사항을 삭제할까요? 담임 화면에서도 사라집니다.")) return;
                  run(async () => {
                    await apiFetch(`/api/admin/records/${r.recordId}`, { method: "DELETE" });
                    return "특기사항을 삭제했습니다.";
                  });
                }}
              >
                삭제
              </button>
            </div>
            <p className="prose-ko mt-3 text-[14px] whitespace-pre-wrap text-body">{r.editedText || r.generatedText}</p>
          </Card>
        ))}
        {data.records.length === 0 && <Card className="py-8 text-center text-muted">저장된 특기사항이 없습니다.</Card>}
      </div>
    </main>
  );
}
