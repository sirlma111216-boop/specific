"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { DEFAULT_GUIDANCE } from "@/lib/events/defaults";
import { PHASE_LABEL } from "@/lib/events/phase";
import { CATEGORY_LABEL, type Category, type EventDoc, type EventPhase } from "@/lib/types";
import { formatDateDots, todayInKST } from "@/lib/utils";

type EventItem = EventDoc & { submittedCount: number; phase: EventPhase };

interface EventsResponse {
  events: EventItem[];
  studentCount: number;
  today: string;
}

const EMPTY_FORM = {
  category: "autonomous" as Category,
  title: "",
  eventDate: todayInKST(),
  description: "",
  guidance: DEFAULT_GUIDANCE,
};

export default function TeacherEventsPage() {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        const res = await apiFetch<EventsResponse>("/api/teacher/events");
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
      await apiFetch("/api/teacher/events", { method: "POST", body: JSON.stringify(form) });
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
      await apiFetch(`/api/teacher/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(event: EventItem) {
    if (!window.confirm(`'${event.title}' 활동을 삭제할까요?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/teacher/events/${event.eventId}`, { method: "DELETE" });
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
          <p className="mt-2 text-[14px] text-muted">
            학생은 <strong className="text-ink">활동 당일에만</strong> 소감을 쓸 수 있고, 날짜가
            지나면 자동으로 마감됩니다. 결석 등으로 예외가 필요하면 &lsquo;다시 열기&rsquo;를
            눌러주세요.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "닫기" : "활동 등록"}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {creating && (
        <Card className="mb-8">
          <h2 className="mb-6 text-[20px] text-ink">활동 등록</h2>
          <form onSubmit={createEvent}>
            <div className="grid gap-x-4 sm:grid-cols-3">
              <Field label="활동 영역" htmlFor="category">
                <Select
                  id="category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, category: e.target.value as Category }))
                  }
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
                <span className="ml-auto text-[13px] text-muted">
                  {event.submittedCount}/{data.studentCount}명 작성
                </span>
              </div>

              {event.description && (
                <p className="prose-ko mt-3 text-[14px] text-body">{event.description}</p>
              )}

              {/* 버튼은 raw status가 아니라 계산된 상태를 따른다.
                  날짜가 지나 자동 마감된 활동에도 '다시 열기'가 나와야 한다. */}
              <div className="mt-4 flex flex-wrap gap-2">
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
                {event.submittedCount === 0 && (
                  <Button size="sm" variant="danger" onClick={() => remove(event)}>
                    삭제
                  </Button>
                )}
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
