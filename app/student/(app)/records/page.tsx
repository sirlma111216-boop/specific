"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { RecordCalendar } from "@/components/student/record-calendar";
import { AnswerView } from "@/components/student/answer-view";
import { RecordEditor, type SavedRecord } from "@/components/student/record-editor";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { emptyRecordText, PHASE_LABEL } from "@/lib/events/phase";
import { CATEGORY_LABEL, type StudentEventItem } from "@/lib/types";
import { cn, formatDateShort } from "@/lib/utils";

interface RecordsResponse {
  today: string;
  items: StudentEventItem[];
}

export default function StudentRecordsPage() {
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [open, setOpen] = useState<string | null>(null);
  /** 마감 전 기록을 고치는 중인 활동 */
  const [editing, setEditing] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  function applySaved(eventId: string, saved: SavedRecord) {
    setData((prev) =>
      prev && {
        ...prev,
        items: prev.items.map((it) =>
          it.eventId === eventId ? { ...it, ...saved, phase: "submitted" } : it,
        ),
      },
    );
    setEditing(null);
    setJustSaved(eventId);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<RecordsResponse>("/api/student/records");
        if (alive) setData(res);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const pending = data.items.filter((i) => i.phase === "writable");

  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[26px] leading-[1.3] text-ink">내 기록</h1>
        <div className="flex gap-1 rounded-sm border border-hairline p-1">
          {(["list", "calendar"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "rounded-xs px-3 py-1.5 text-[13px]",
                view === key ? "bg-ink text-white" : "text-body",
              )}
            >
              {key === "list" ? "목록" : "달력"}
            </button>
          ))}
        </div>
      </div>

      {pending.length > 0 && (
        <Link
          href="/student/today"
          className="mb-6 block rounded-md bg-cream px-4 py-3 text-[14px] text-ink"
        >
          아직 작성하지 않은 활동이 {pending.length}개 있습니다. 지금 작성하기 →
        </Link>
      )}

      {data.items.length === 0 ? (
        <Card className="py-16 text-center text-muted">아직 공개된 활동이 없습니다.</Card>
      ) : view === "calendar" ? (
        <Card>
          <RecordCalendar items={data.items} />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline">
          <table className="w-full text-[14px]">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="w-20 px-4 py-3 text-left font-medium">날짜</th>
                <th className="w-14 px-2 py-3 text-left font-medium">영역</th>
                <th className="px-2 py-3 text-left font-medium">활동</th>
                <th className="w-24 px-4 py-3 text-left font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.eventId} className="border-t border-hairline align-top">
                  <td colSpan={4} className="p-0">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(open === item.eventId ? null : item.eventId);
                        setEditing(null);
                        setJustSaved(null);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left"
                    >
                      <span className="w-14 shrink-0 text-muted">
                        {formatDateShort(item.eventDate)}
                      </span>
                      <span className="w-10 shrink-0 text-muted">
                        {CATEGORY_LABEL[item.category]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
                      <Badge tone={item.phase === "submitted" ? "success" : "muted"}>
                        {PHASE_LABEL[item.phase]}
                      </Badge>
                    </button>
                    {open === item.eventId && (
                      <div className="border-t border-hairline bg-surface-soft px-4 py-4">
                        {editing === item.eventId ? (
                          <RecordEditor
                            item={item}
                            onSaved={(saved) => applySaved(item.eventId, saved)}
                            onCancel={() => setEditing(null)}
                          />
                        ) : (
                          <>
                            <AnswerView
                              form={item.form}
                              answers={item.answers}
                              fallback={item.content}
                              emptyText={emptyRecordText(item.phase)}
                            />
                            {justSaved === item.eventId && (
                              <p className="mt-3 text-[13px] text-success">
                                고친 내용을 저장했습니다.
                              </p>
                            )}
                            {item.phase === "writable" && (
                              <Link
                                href="/student/today"
                                className="mt-3 inline-block text-[13px] text-link underline underline-offset-2"
                              >
                                지금 작성하기 →
                              </Link>
                            )}
                            {/* 마감 전까지는 이미 낸 기록도 고칠 수 있다. 마감되면 보기만 한다. */}
                            {item.phase === "submitted" && item.canWrite && (
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditing(item.eventId);
                                    setJustSaved(null);
                                  }}
                                  className="text-[13px] text-link underline underline-offset-2"
                                >
                                  수정하기
                                </button>
                                <span className="text-[13px] text-muted">
                                  마감 전까지 고칠 수 있습니다.
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
