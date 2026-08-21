"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Badge, Spinner } from "@/components/ui/surface";
import { FormBuilder } from "@/components/admin/form-builder";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { resolveForm, type FormQuestion } from "@/lib/forms/schema";
import { CATEGORY_LABEL, type EventDoc } from "@/lib/types";
import { formatDateDots } from "@/lib/utils";

interface EventsResponse {
  events: Array<EventDoc & { submittedCount: number; questionCount: number }>;
  studentCount: number;
}

export default function AdminEventFormPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [event, setEvent] = useState<(EventDoc & { submittedCount: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 활동 수가 많지 않아 목록에서 골라 쓴다. (단건 조회 라우트를 따로 두지 않음)
        const res = await apiFetch<EventsResponse>("/api/admin/events");
        if (!alive) return;
        const found = res.events.find((e) => e.eventId === eventId);
        if (!found) {
          setError("활동을 찾을 수 없습니다.");
          return;
        }
        setEvent(found);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventId]);

  if (error) return <Alert>{error}</Alert>;
  if (!event) return <Spinner />;

  const initial: FormQuestion[] = resolveForm(event.form);

  return (
    <main>
      <Link href="/admin/events" className="mb-6 inline-block text-[13px] text-muted">
        ← 자율·진로 활동
      </Link>

      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={event.category === "autonomous" ? "info" : "neutral"}>
            {CATEGORY_LABEL[event.category]}
          </Badge>
          <h1 className="text-[28px] leading-[1.2] text-ink">{event.title}</h1>
          <span className="text-[14px] text-muted">{formatDateDots(event.eventDate)}</span>
        </div>
        <p className="prose-ko mt-3 max-w-[620px] text-[14px] text-muted">
          학생이 활동 당일에 답할 양식입니다. 답변은 담임 선생님의 특기사항 작성 자료로 쓰입니다.
        </p>
        {event.submittedCount > 0 && (
          <div className="mt-4">
            <Alert tone="info">
              {`이미 ${event.submittedCount}명이 답했습니다. 양식을 바꿔도 기존 답변은 그대로 남습니다.`}
            </Alert>
          </div>
        )}
      </div>

      <FormBuilder eventId={eventId} initial={initial} />
    </main>
  );
}
