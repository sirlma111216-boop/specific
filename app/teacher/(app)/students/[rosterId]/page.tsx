"use client";

import { useParams } from "next/navigation";
import { StudentDetail } from "@/components/teacher/student-detail";

export default function StudentDetailPage() {
  const params = useParams<{ rosterId: string }>();
  // key로 학생이 바뀔 때마다 새로 마운트시켜, 이전 학생의 선택 상태가 남지 않게 한다.
  return <StudentDetail key={params.rosterId} rosterId={params.rosterId} />;
}
