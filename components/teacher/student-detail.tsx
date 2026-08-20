"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Spinner } from "@/components/ui/surface";
import { RecordWorkspace } from "@/components/teacher/record-workspace";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  CATEGORY_LABEL,
  type Category,
  type SignupStatus,
  type StudentRecordDoc,
  type TeacherEventWithResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import type { OfficerTerm } from "@/lib/roster/officer";

interface DetailResponse {
  student: {
    rosterId: string;
    studentNumber: number;
    studentName: string;
    signupStatus: SignupStatus;
    officerTerms: OfficerTerm[];
  };
  events: Record<Category, TeacherEventWithResponse[]>;
  records: Partial<Record<Category, StudentRecordDoc>>;
  neighbors: {
    prev: { rosterId: string; studentNumber: number; studentName: string } | null;
    next: { rosterId: string; studentNumber: number; studentName: string } | null;
    position: number;
    total: number;
  };
}

export function StudentDetail({ rosterId }: { rosterId: string }) {
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Category>("autonomous");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<DetailResponse>(`/api/teacher/students/${rosterId}`);
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
  }, [rosterId]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const { student, neighbors } = data;

  return (
    <main>
      <Link href="/teacher/students" className="mb-6 inline-block text-[13px] text-muted">
        ← 학급 학생
      </Link>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[32px] leading-[1.2] text-ink">
              {student.studentNumber}번 {student.studentName}
            </h1>
            {student.signupStatus === "linked" ? (
              <Badge tone="success">가입 완료</Badge>
            ) : (
              <Badge tone="muted">미가입</Badge>
            )}
          </div>
          <p className="mt-2 text-[14px] text-muted">
            {neighbors.position} / {neighbors.total}명
          </p>
        </div>

        {/* 학생 목록으로 돌아가지 않고 연속으로 처리할 수 있게 한다 */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!neighbors.prev}
            onClick={() =>
              neighbors.prev && router.push(`/teacher/students/${neighbors.prev.rosterId}`)
            }
          >
            ← 이전 학생
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!neighbors.next}
            onClick={() =>
              neighbors.next && router.push(`/teacher/students/${neighbors.next.rosterId}`)
            }
          >
            다음 학생 →
          </Button>
        </div>
      </div>

      <div className="mb-8 flex gap-2 border-b border-hairline">
        {(["autonomous", "career"] as Category[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-[16px]",
              tab === key ? "border-ink text-ink" : "border-transparent text-muted",
            )}
          >
            {CATEGORY_LABEL[key]}
          </button>
        ))}
      </div>

      {/* 자율/진로 특기사항은 완전히 따로 생성한다. key로 작업 상태도 분리한다. */}
      <RecordWorkspace
        key={`${rosterId}-${tab}`}
        rosterId={rosterId}
        category={tab}
        events={data.events[tab]}
        savedRecord={data.records[tab]}
        officerTerms={student.officerTerms ?? []}
      />
    </main>
  );
}
