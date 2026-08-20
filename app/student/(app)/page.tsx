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
 * 학생 로그인 직후 화면.
 *
 * 작성할 활동이 있으면 메뉴를 거치지 않고 곧바로 입력 화면을 그린다.
 * 예전에는 여기서 조회한 뒤 /student/today로 넘겨 같은 조회를 한 번 더 했다.
 * 학생 한 명당 조회가 두 번씩 나가 Firestore 읽기가 두 배로 들었으므로,
 * 받아온 목록을 그대로 넘겨 화면만 바꾼다.
 */
export default function StudentGate() {
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
