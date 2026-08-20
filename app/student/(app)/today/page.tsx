"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/ui/surface";
import { TodayWriter } from "@/components/student/today-writer";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { StudentEventItem } from "@/lib/types";

interface TodayResponse {
  today: string;
  pending: StudentEventItem[];
}

/**
 * '내 기록' 화면의 "지금 작성하기" 링크로 들어오는 경로.
 * 로그인 직후 흐름은 /student 에서 조회 없이 바로 그려진다.
 */
export default function StudentTodayPage() {
  const router = useRouter();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<TodayResponse>("/api/student/today");
        if (!alive) return;
        if (res.pending.length === 0) {
          router.replace("/student/records");
          return;
        }
        setData(res);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  return <TodayWriter today={data.today} pending={data.pending} />;
}
