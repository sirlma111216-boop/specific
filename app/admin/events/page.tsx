"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { EventBasicsForm, type EventBasics } from "@/components/admin/event-basics-form";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { DEFAULT_GUIDANCE } from "@/lib/events/defaults";
import { PHASE_LABEL } from "@/lib/events/phase";
import {
  CATEGORY_LABEL,
  type Category,
  type EventDoc,
  type EventPhase,
  type EventStatus,
} from "@/lib/types";
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

type Filter = "all" | Category | "test";

const EMPTY: EventBasics = {
  category: "autonomous",
  isTest: false,
  title: "",
  eventDate: todayInKST(),
  description: "",
  guidance: DEFAULT_GUIDANCE,
};

/** 날짜를 1년 뒤로. 복사할 때 기본값으로 쓴다. (2월 29일은 2월 28일로) */
function plusOneYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(y + 1, m - 1, Math.min(d, 28)));
  return next.toISOString().slice(0, 10);
}

export default function AdminEventsPage() {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EventBasics>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  /** 카드 안에서 열려 있는 편집/복사 패널. 한 번에 하나만 연다. */
  const [panel, setPanel] = useState<{ eventId: string; kind: "edit" | "copy" } | null>(null);
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
      setForm({ ...EMPTY, category: form.category, isTest: form.isTest });
      setCreating(false);
      setNotice("활동을 등록했습니다.");
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function patch(eventId: string, body: Record<string, unknown>, done?: string) {
    setError(null);
    try {
      await apiFetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (done) setNotice(done);
      setPanel(null);
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

  const events = (data?.events ?? []).filter((e) => {
    if (filter === "all") return true;
    if (filter === "test") return Boolean(e.isTest);
    return e.category === filter && !e.isTest;
  });

  return (
    <main>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-[1.2] text-ink">자율·진로 활동</h1>
          <p className="prose-ko mt-2 max-w-[620px] text-[14px] text-muted">
            여기서 등록한 활동은 <strong className="text-ink">모든 학급 학생</strong>에게 똑같이
            열립니다. 학생은 활동 당일에만 답할 수 있고, 날짜가 지나면 자동으로 마감됩니다.
            <strong className="text-ink"> 테스트</strong> 활동은 연수용 테스트 계정에게만 보입니다.
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
            <EventBasicsForm value={form} onChange={setForm} idPrefix="new" />
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

      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", "autonomous", "career", "test"] as const).map((key) => (
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
            {key === "all" ? "전체" : key === "test" ? "테스트" : CATEGORY_LABEL[key]}
          </button>
        ))}
      </div>

      {!data && !error && <Spinner />}

      {data && (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard
              key={event.eventId}
              event={event}
              studentCount={data.studentCount}
              panel={panel?.eventId === event.eventId ? panel.kind : null}
              onOpenPanel={(kind) =>
                setPanel((p) =>
                  p?.eventId === event.eventId && p.kind === kind
                    ? null
                    : { eventId: event.eventId, kind },
                )
              }
              onPatch={(body, done) => patch(event.eventId, body, done)}
              onCopied={(title) => {
                setPanel(null);
                setNotice(`'${title}' 활동을 복사했습니다. 새 카드에서 날짜와 공개 여부를 확인하세요.`);
                reload();
              }}
              onRemove={() => remove(event)}
              onError={setError}
            />
          ))}
          {events.length === 0 && (
            <Card className="py-14 text-center text-muted">등록된 활동이 없습니다.</Card>
          )}
        </div>
      )}
    </main>
  );
}

function EventCard({
  event,
  studentCount,
  panel,
  onOpenPanel,
  onPatch,
  onCopied,
  onRemove,
  onError,
}: {
  event: EventItem;
  studentCount: number;
  panel: "edit" | "copy" | null;
  onOpenPanel: (kind: "edit" | "copy") => void;
  onPatch: (body: Record<string, unknown>, done?: string) => Promise<void>;
  onCopied: (title: string) => void;
  onRemove: () => void;
  onError: (message: string) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {event.isTest && <Badge tone="coral">테스트</Badge>}
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
          {event.submittedCount}/{event.isTest ? "테스트" : `${studentCount}명`} 작성
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
        <Button size="sm" variant="secondary" onClick={() => onOpenPanel("edit")}>
          {panel === "edit" ? "편집 닫기" : "기본 정보 편집"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onOpenPanel("copy")}>
          {panel === "copy" ? "복사 닫기" : "이 활동 복사"}
        </Button>
        {event.phase === "scheduled" && (
          <Button size="sm" variant="secondary" onClick={() => onPatch({ status: "open" })}>
            지금 공개
          </Button>
        )}
        {event.phase !== "closed" && (
          <Button size="sm" variant="secondary" onClick={() => onPatch({ status: "closed" })}>
            마감
          </Button>
        )}
        {event.phase === "closed" && (
          <Button size="sm" variant="secondary" onClick={() => onPatch({ status: "open" })}>
            다시 열기
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={onRemove}>
          삭제
        </Button>
      </div>

      {panel === "edit" && (
        <EditPanel event={event} onSave={(body) => onPatch(body, "활동 정보를 저장했습니다.")} />
      )}
      {panel === "copy" && <CopyPanel event={event} onCopied={onCopied} onError={onError} />}
    </Card>
  );
}

/** 기본 정보 편집. 영역을 바꾸면 학생별 기록 수가 옮겨진다는 것을 알린다. */
function EditPanel({
  event,
  onSave,
}: {
  event: EventItem;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState<EventBasics>({
    category: event.category,
    isTest: Boolean(event.isTest),
    title: event.title,
    eventDate: event.eventDate,
    description: event.description,
    guidance: event.guidance,
  });
  const [busy, setBusy] = useState(false);
  const categoryChanged = value.category !== event.category;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      categoryChanged &&
      event.submittedCount > 0 &&
      !window.confirm(
        `영역을 ${CATEGORY_LABEL[event.category]}에서 ${CATEGORY_LABEL[value.category]}(으)로 바꿉니다.\n` +
          `이미 답한 학생 ${event.submittedCount}명의 기록이 ${CATEGORY_LABEL[value.category]} 활동 기록으로 옮겨집니다.\n\n계속할까요?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...value });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 border-t border-hairline pt-5">
      <h4 className="mb-4 text-[15px] font-medium text-ink">기본 정보 편집</h4>
      <EventBasicsForm value={value} onChange={setValue} idPrefix={`edit-${event.eventId}`} />
      {categoryChanged && (
        <p className="mb-4 text-[13px] text-coral">
          영역을 바꾸면 이 활동에 기록이 있는 학생들의 자율·진로 기록 수가 함께 옮겨집니다.
        </p>
      )}
      <Button type="submit" size="sm" loading={busy}>
        저장
      </Button>
    </form>
  );
}

/** 복사. 양식은 그대로, 날짜와 공개 여부만 새로 받는다. */
function CopyPanel({
  event,
  onCopied,
  onError,
}: {
  event: EventItem;
  onCopied: (title: string) => void;
  onError: (message: string) => void;
}) {
  const [eventDate, setEventDate] = useState(plusOneYear(event.eventDate));
  const [status, setStatus] = useState<EventStatus>("scheduled");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(`/api/admin/events/${event.eventId}/copy`, {
        method: "POST",
        body: JSON.stringify({ eventDate, status }),
      });
      onCopied(event.title);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 border-t border-hairline pt-5">
      <h4 className="mb-1 text-[15px] font-medium text-ink">이 활동 복사</h4>
      <p className="mb-4 text-[13px] text-muted">
        제목·설명·안내문·응답 양식({event.questionCount}개 질문)이 그대로 복사됩니다. 학생 응답은
        복사되지 않습니다.
      </p>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="새 활동 날짜" htmlFor={`copy-date-${event.eventId}`}>
          <Input
            id={`copy-date-${event.eventId}`}
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </Field>
        <Field label="공개 여부" htmlFor={`copy-status-${event.eventId}`}>
          <Select
            id={`copy-status-${event.eventId}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as EventStatus)}
          >
            <option value="scheduled">예정 (당일에 자동 공개)</option>
            <option value="open">지금 공개</option>
            <option value="closed">마감 상태로 두기</option>
          </Select>
        </Field>
      </div>
      <Button type="submit" size="sm" loading={busy}>
        복사해서 새 활동 만들기
      </Button>
    </form>
  );
}
