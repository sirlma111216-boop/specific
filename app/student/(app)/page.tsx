"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { StudentEventItem } from "@/lib/types";

interface TodayResponse {
  today: string;
  pending: StudentEventItem[];
}

/**
 * 학생 로그인 직후 게이트.
 * 작성해야 할 활동이 있으면 메뉴를 거치지 않고 곧바로 입력 화면으로 보낸다.
 */
export default function StudentGate() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<TodayResponse>("/api/student/today");
        if (!alive) return;
        router.replace(data.pending.length > 0 ? "/student/today" : "/student/records");
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (error) return <Alert>{error}</Alert>;
  return <Spinner />;
}
