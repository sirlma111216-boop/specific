"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { EventDoc } from "@/lib/types";
import { formatDateDots } from "@/lib/utils";

interface EventsResponse {
  events: Array<EventDoc & { submittedCount: number; questionCount: number }>;
  studentCount: number;
  classCount: number;
  today: string;
}

export default function AdminDashboard() {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<EventsResponse>("/api/admin/events");
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

  const todayEvents = data.events.filter((e) => e.eventDate === data.today);

  return (
    <main>
      <div className="mb-10">
        <p className="mb-3 text-[14px] font-medium tracking-[0.16px] text-muted">학교 전체</p>
        <h1 className="text-[32px] leading-[1.2] text-ink">관리자</h1>
        <p className="prose-ko mt-3 max-w-[560px] text-[14px] text-muted">
          자율·진로 활동의 날짜와 응답 양식을 정합니다. 여기서 등록한 활동은 모든 학급 학생에게
          똑같이 열립니다. 학생 기록 관리와 특기사항 작성은 각 담임 선생님이 합니다.
        </p>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Stat label="등록된 활동" value={`${data.events.length}개`} />
        <Stat label="학급" value={`${data.classCount}개`} />
        <Stat label="학생" value={`${data.studentCount}명`} />
      </div>

      {todayEvents.length > 0 && (
        <div className="mb-10 rounded-md bg-cream p-6">
          <h2 className="mb-3 text-[18px] font-medium text-ink">오늘 진행되는 활동</h2>
          <ul className="space-y-2">
            {todayEvents.map((e) => (
              <li key={e.eventId} className="text-[14px] text-body">
                {e.title}
                <span className="ml-2 text-muted">
                  {formatDateDots(e.eventDate)} · {e.submittedCount}/{data.studentCount}명 작성
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/admin/events"
        className="block rounded-md border border-hairline bg-canvas p-6 transition-colors active:bg-surface-soft sm:max-w-[560px]"
      >
        <h2 className="text-[18px] font-medium text-ink">자율·진로 활동</h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-muted">
          활동 날짜를 등록하고, 학생이 답할 양식(객관식·주관식)을 만듭니다.
        </p>
      </Link>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-2 text-[28px] leading-[1.2] text-ink">{value}</p>
    </Card>
  );
}
