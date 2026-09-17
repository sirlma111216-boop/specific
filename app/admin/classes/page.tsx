"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { ClassSummary } from "@/lib/admin/lookup";
import { formatClassFull } from "@/lib/utils";

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<{ classes: ClassSummary[] }>("/api/admin/classes");
        if (alive) setClasses(res.classes);
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-[32px] leading-[1.2] text-ink">학급</h1>
        <p className="mt-2 text-[14px] text-muted">
          학급을 누르면 담임 계정, 학생 명단, 가입 상태를 보고 고칠 수 있습니다.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {!classes && !error && <Spinner />}

      {classes && (
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">학급</th>
                <th className="px-4 py-3 text-left font-medium">담임</th>
                <th className="px-4 py-3 text-left font-medium">담임 계정</th>
                <th className="w-32 px-4 py-3 text-left font-medium">가입 / 명단</th>
                <th className="w-24 px-4 py-3 text-left font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.classId} className="border-t border-hairline">
                  <td className="px-4 py-3">
                    <Link href={`/admin/classes/${c.classId}`} prefetch={false} className="text-ink underline underline-offset-2">
                      {formatClassFull(c.schoolYear, c.grade, c.classNumber)}
                    </Link>
                    {c.isTest && <Badge tone="coral" className="ml-2">테스트</Badge>}
                  </td>
                  <td className="px-4 py-3 text-body">{c.teacherName}</td>
                  <td className="px-4 py-3 text-muted">{c.teacherEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-body">
                    {c.linkedCount} / {c.studentCount}명
                  </td>
                  <td className="px-4 py-3">
                    {c.teacherMissing ? (
                      <Badge tone="coral">담임 없음</Badge>
                    ) : c.studentCount > 0 && c.linkedCount === c.studentCount ? (
                      <Badge tone="success">가입 완료</Badge>
                    ) : (
                      <Badge tone="muted">진행 중</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">
                    등록된 학급이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
