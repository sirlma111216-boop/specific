"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Card, Spinner } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { AccountSummary, ClassSummary } from "@/lib/admin/lookup";
import { formatClassFull } from "@/lib/utils";

interface Overview {
  counts: {
    classes: number;
    testClasses: number;
    teachers: number;
    students: number;
    rosterTotal: number;
    rosterLinked: number;
  };
  classes: ClassSummary[];
  problems: AccountSummary[];
  classesWithoutTeacher: ClassSummary[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<Overview>("/api/admin/overview");
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

  const { counts } = data;
  const lowSignup = data.classes.filter(
    (c) => !c.isTest && c.studentCount > 0 && c.linkedCount / c.studentCount < 0.5,
  );

  return (
    <main>
      <div className="mb-10">
        <p className="mb-3 text-[14px] font-medium tracking-[0.16px] text-muted">학교 전체</p>
        <h1 className="text-[32px] leading-[1.2] text-ink">관리자</h1>
        <p className="prose-ko mt-3 max-w-[620px] text-[14px] text-muted">
          활동·학급·계정을 여기서 관리합니다. 어긋난 계정이나 담임 없는 학급이 있으면 아래에
          바로 나타납니다.
        </p>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="학급" value={`${counts.classes}개`} sub={counts.testClasses ? `+ 테스트 ${counts.testClasses}개` : undefined} href="/admin/classes" />
        <Stat label="교사 계정" value={`${counts.teachers}명`} href="/admin/accounts?role=teacher" />
        <Stat label="학생 가입" value={`${counts.rosterLinked} / ${counts.rosterTotal}명`} sub="명단 대비" href="/admin/classes" />
        <Stat label="어긋난 계정" value={`${data.problems.length}건`} tone={data.problems.length ? "warn" : undefined} href="/admin/accounts?filter=problem" />
      </div>

      {data.classesWithoutTeacher.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[18px] font-medium text-ink">담임 계정이 연결되지 않은 학급</h2>
          <Card padded={false}>
            <ul className="divide-y divide-hairline">
              {data.classesWithoutTeacher.map((c) => (
                <li key={c.classId} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14px]">
                  <Link href={`/admin/classes/${c.classId}`} prefetch={false} className="text-ink underline underline-offset-2">
                    {formatClassFull(c.schoolYear, c.grade, c.classNumber)}
                  </Link>
                  <span className="text-muted">담임 {c.teacherName}</span>
                  <span className="text-coral">
                    {c.teacherEmail ? "계정이 이 학급을 가리키지 않음" : "담임 계정 없음"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {data.problems.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[18px] font-medium text-ink">학급·명단과 어긋난 계정</h2>
          <Card padded={false}>
            <ul className="divide-y divide-hairline">
              {data.problems.slice(0, 20).map((a) => (
                <li key={a.uid} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14px]">
                  <Badge tone={a.role === "teacher" ? "info" : "neutral"}>
                    {a.role === "teacher" ? "교사" : "학생"}
                  </Badge>
                  <span className="text-ink">{a.email}</span>
                  {a.classLabel && <span className="text-muted">{a.classLabel}</span>}
                  <span className="text-coral">{a.problem}</span>
                </li>
              ))}
            </ul>
            {data.problems.length > 20 && (
              <p className="px-5 py-3 text-[13px] text-muted">
                외 {data.problems.length - 20}건 —{" "}
                <Link href="/admin/accounts?filter=problem" className="text-link underline underline-offset-2">
                  계정 화면에서 전체 보기
                </Link>
              </p>
            )}
          </Card>
        </section>
      )}

      {lowSignup.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[18px] font-medium text-ink">가입이 절반도 안 된 학급</h2>
          <Card padded={false}>
            <ul className="divide-y divide-hairline">
              {lowSignup.map((c) => (
                <li key={c.classId} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14px]">
                  <Link href={`/admin/classes/${c.classId}`} prefetch={false} className="text-ink underline underline-offset-2">
                    {formatClassFull(c.schoolYear, c.grade, c.classNumber)}
                  </Link>
                  <span className="text-muted">
                    {c.linkedCount} / {c.studentCount}명 가입
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Shortcut href="/admin/events" title="활동" text="자율·진로·테스트 활동을 등록하고 양식을 만듭니다." />
        <Shortcut href="/admin/classes" title="학급" text="학급 정보·담임·명단을 보고 고칩니다. 학생을 누르면 기록까지 봅니다." />
        <Shortcut href="/admin/accounts" title="계정" text="교사·학생 계정을 만들고, 비밀번호를 바꾸고, 학급·명단에 다시 연결합니다." />
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  href: string;
  tone?: "warn";
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors active:bg-surface-soft">
        <p className="text-[13px] text-muted">{label}</p>
        <p className={`mt-2 text-[28px] leading-[1.2] ${tone === "warn" ? "text-coral" : "text-ink"}`}>{value}</p>
        {sub && <p className="mt-1 text-[12px] text-muted">{sub}</p>}
      </Card>
    </Link>
  );
}

function Shortcut({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-hairline bg-canvas p-6 transition-colors active:bg-surface-soft"
    >
      <h2 className="text-[18px] font-medium text-ink">{title}</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-muted">{text}</p>
    </Link>
  );
}
