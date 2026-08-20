"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { EventDoc, StudentListItem } from "@/lib/types";
import { formatClassName, formatSchoolYear } from "@/lib/utils";

interface StudentsResponse {
  students: StudentListItem[];
}
interface EventsResponse {
  events: Array<EventDoc & { submittedCount: number }>;
  today: string;
}

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, e] = await Promise.all([
          apiFetch<StudentsResponse>("/api/teacher/students"),
          apiFetch<EventsResponse>("/api/teacher/events"),
        ]);
        if (!alive) return;
        setStudents(s.students);
        setEvents(e);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const klass = profile?.klass;
  const linked = students?.filter((s) => s.signupStatus === "linked").length ?? 0;
  const todayEvents = events?.events.filter((e) => e.eventDate === events.today) ?? [];

  return (
    <main>
      <div className="mb-10">
        <p className="mb-3 text-[14px] font-medium tracking-[0.16px] text-muted">
          {klass ? `${formatSchoolYear(klass.schoolYear)} · ${klass.schoolName}` : "학급"}
        </p>
        <h1 className="text-[32px] leading-[1.2] text-ink">
          {klass ? formatClassName(klass.grade, klass.classNumber) : "대시보드"}
        </h1>
      </div>

      {error && <Alert>{error}</Alert>}
      {!students && !error && <Spinner />}

      {students && (
        <>
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            <Stat label="학생" value={`${students.length}명`} />
            <Stat label="가입 완료" value={`${linked}명`} sub={`미가입 ${students.length - linked}명`} />
            <Stat label="등록된 활동" value={`${events?.events.length ?? 0}개`} />
          </div>

          {todayEvents.length > 0 && (
            <div className="mb-10 rounded-md bg-cream p-6">
              <h2 className="mb-3 text-[18px] font-medium text-ink">오늘 진행되는 활동</h2>
              <ul className="space-y-2">
                {todayEvents.map((e) => (
                  <li key={e.eventId} className="text-[14px] text-body">
                    {e.title}
                    <span className="ml-2 text-muted">
                      {e.submittedCount}/{students.length}명 작성
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 실제로 가는 곳이 두 군데뿐이라 카드도 둘로 둔다. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <NavCard
              href="/teacher/students"
              title="학급 학생"
              body="가입 상태와 활동 기록을 확인하고, 학생을 눌러 생기부 특기사항 초안을 만듭니다."
            />
            <NavCard
              href="/teacher/events"
              title="자율·진로 활동"
              body="활동을 등록하고 공개·마감을 제어합니다."
            />
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-2 text-[28px] leading-[1.2] text-ink">{value}</p>
      {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
    </Card>
  );
}

function NavCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-hairline bg-canvas p-6 transition-colors active:bg-surface-soft"
    >
      <h2 className="text-[18px] font-medium text-ink">{title}</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-muted">{body}</p>
    </Link>
  );
}
