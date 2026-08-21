"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import type { StudentListItem } from "@/lib/types";
import { formatClassName, formatSchoolYear } from "@/lib/utils";

interface StudentsResponse {
  students: StudentListItem[];
}

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await apiFetch<StudentsResponse>("/api/teacher/students");
        if (!alive) return;
        setStudents(s.students);
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
          <div className="mb-10 grid gap-4 sm:grid-cols-2">
            <Stat label="학생" value={`${students.length}명`} />
            <Stat label="가입 완료" value={`${linked}명`} sub={`미가입 ${students.length - linked}명`} />
          </div>

          <NavCard
            href="/teacher/students"
            title="학급 학생"
            body="가입 상태와 활동 기록을 확인하고, 학생을 눌러 생기부 특기사항 초안을 만듭니다."
          />
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
