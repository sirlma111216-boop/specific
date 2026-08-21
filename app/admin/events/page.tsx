"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { DEFAULT_GUIDANCE } from "@/lib/events/defaults";
import { PHASE_LABEL } from "@/lib/events/phase";
import { CATEGORY_LABEL, type Category, type EventDoc, type EventPhase } from "@/lib/types";
import { formatDateDots, todayInKST } from "@/lib/utils";

type EventItem = EventDoc & {
  submittedCount: number;
  questionCount: number;
  phase: EventPhase;
};

interface EventsResponse {
  events: EventItem[];
  studentCount: number;
  classCount: number;
  today: string;
}

const EMPTY_FORM = {
  category: "autonomous" as Category,
  title: "",
  eventDate: todayInKST(),
  description: "",
  guidance: DEFAULT_GUIDANCE,
};

export default function AdminEventsPage() {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<EventsResponse>("/api/admin/events");
        if (!alive) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/events", { method: "POST", body: JSON.stringify(form) });
      setForm({ ...EMPTY_FORM, category: form.category });
      setCreating(false);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function patch(eventId: string, body: Record<string, unknown>) {
    setError(null);
    try {
      await apiFetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(event: EventItem) {
    // 되돌릴 수 없고 학생 응답까지 함께 지워지므로, 무엇이 사라지는지 분명히 알린다.
    const warning =
      event.submittedCount > 0
        ? `'${event.title}' 활동을 삭제합니다.\n\n` +
          `학생 응답 ${event.submittedCount}건과 교사가 보완한 기록이 함께 삭제되며, 되돌릴 수 없습니다.\n` +
          `학생별 자율·진로 기록 수에서도 빠집니다.\n\n` +
          `그래도 삭제할까요?`
        : `'${event.title}' 활동을 삭제할까요?`;
    if (!window.confirm(warning)) return;

    setError(null);
    try {
      const res = await apiFetch<{ deletedResponses: number }>(
        `/api/admin/events/${event.eventId}`,
        { method: "DELETE" },
      );
      setNotice(
        res.deletedResponses > 0
          ? `활동을 삭제했습니다. 학생 응답 ${res.deletedResponses}건도 함께 정리했습니다.`
          : "활동을 삭제했습니다.",
      );
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const events = (data?.events ?? []).filter((e) => filter === "all" || e.category === filter);

  return (
    <main>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-[1.2] text-ink">자율·진로 활동</h1>
          <p className="prose-ko mt-2 max-w-[620px] text-[14px] text-muted">
            여기서 등록한 활동은 <strong className="text-ink">모든 학급 학생</strong>에게 똑같이
            열립니다. 학생은 활동 당일에만 답할 수 있고, 날짜가 지나면 자동으로 마감됩니다.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "닫기" : "활동 등록"}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {creating && (
        <Card className="mb-8">
          <h2 className="mb-6 text-[20px] text-ink">활동 등록</h2>
          <form onSubmit={createEvent}>
            <div className="grid gap-x-4 sm:grid-cols-3">
              <Field label="활동 영역" htmlFor="category">
                <Select
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Category }))}
                >
                  <option value="autonomous">자율</option>
                  <option value="career">진로</option>
                </Select>
              </Field>
              <Field label="활동명" htmlFor="title" hint="예: 학교폭력 예방교육">
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </Field>
              <Field label="활동 날짜" htmlFor="eventDate">
                <Input
                  id="eventDate"
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm((p) => ({ ...p, eventDate: e.target.value }))}
                  required
                />
              </Field>
            </div>
            <Field
              label="활동 설명"
              htmlFor="description"
              hint="학생이 어떤 교육이었는지 알 수 있도록 간단히 적어주세요."
            >
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </Field>
            <Field label="학생 안내문" htmlFor="guidance" hint="필요하면 수정할 수 있습니다.">
              <Textarea
                id="guidance"
                rows={4}
                value={form.guidance}
                onChange={(e) => setForm((p) => ({ ...p, guidance: e.target.value }))}
              />
            </Field>
            <div className="flex gap-3">
              <Button type="submit" size="sm" loading={busy}>
                등록하기
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(false)}>
                취소
              </Button>
            </div>
            <p className="mt-3 text-[13px] text-muted">
              등록하면 자유 서술 한 칸이 기본 양식으로 들어갑니다. 객관식 등을 넣으려면 등록 후
              <strong className="text-ink"> 양식 편집</strong>을 누르세요.
            </p>
          </form>
        </Card>
      )}

      <div className="mb-5 flex gap-2">
        {(["all", "autonomous", "career"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "rounded-sm border border-ink bg-ink px-3 py-1.5 text-[14px] text-white"
                : "rounded-sm border border-hairline bg-canvas px-3 py-1.5 text-[14px] text-body"
            }
          >
            {key === "all" ? "전체" : CATEGORY_LABEL[key]}
          </button>
        ))}
      </div>

      {!data && !error && <Spinner />}

      {data && (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.eventId} className="p-5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <Badge tone={event.category === "autonomous" ? "info" : "neutral"}>
                  {CATEGORY_LABEL[event.category]}
                </Badge>
                <h3 className="text-[18px] font-medium text-ink">{event.title}</h3>
                <span className="text-[14px] text-muted">{formatDateDots(event.eventDate)}</span>
                <Badge tone={event.phase === "closed" ? "muted" : "neutral"}>
                  {PHASE_LABEL[event.phase]}
                </Badge>
                <Badge tone="muted">질문 {event.questionCount}개</Badge>
                <span className="ml-auto text-[13px] text-muted">
                  {event.submittedCount}/{data.studentCount}명 작성
                </span>
              </div>

              {event.description && (
                <p className="prose-ko mt-3 text-[14px] text-body">{event.description}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/events/${event.eventId}`}
                  className="inline-flex items-center rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-[14px] font-medium text-ink"
                >
                  양식 편집
                </Link>
                {event.phase === "scheduled" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => patch(event.eventId, { status: "open" })}
                  >
                    지금 공개
                  </Button>
                )}
                {event.phase !== "closed" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => patch(event.eventId, { status: "closed" })}
                  >
                    마감
                  </Button>
                )}
                {event.phase === "closed" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => patch(event.eventId, { status: "open" })}
                  >
                    다시 열기
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => remove(event)}>
                  삭제
                </Button>
              </div>
            </Card>
          ))}
          {events.length === 0 && (
            <Card className="py-14 text-center text-muted">등록된 활동이 없습니다.</Card>
          )}
        </div>
      )}
    </main>
  );
}
