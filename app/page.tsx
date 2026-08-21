"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { SetupNotice } from "@/components/ui/setup-notice";
import { Spinner } from "@/components/ui/surface";

export default function LandingPage() {
  const { configured, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role === "admin") router.replace("/admin");
    else router.replace(profile.role === "teacher" ? "/teacher" : "/student");
  }, [loading, profile, router]);

  if (!configured) return <SetupNotice />;
  if (loading || profile) return <Spinner />;

  return (
    <main className="mx-auto max-w-[900px] px-6 py-20 sm:py-24">
      <p className="mb-4 text-[14px] font-medium tracking-[0.16px] text-muted">
        창의적 체험활동 · 자율 · 진로
      </p>
      <h1 className="text-[36px] leading-[1.15] text-ink sm:text-[40px]">
        학생이 남긴 기록에서
        <br />
        특기사항 초안을 만듭니다
      </h1>
      <p className="prose-ko mt-6 max-w-[520px] text-[16px] text-body">
        학생은 활동 당일 소감을 남기고, 교사는 그 기록을 골라 생활기록부 특기사항 초안을 만듭니다.
        최종 기록은 언제나 교사가 확인하고 수정합니다.
      </p>

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        <Link
          href="/teacher/login"
          className="block rounded-lg bg-coral p-8 text-white transition-opacity active:opacity-90"
        >
          <h2 className="text-[24px] leading-[1.3] text-white">교사</h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-white/85">
            학급과 학생 명단을 등록하고, 활동을 만들고, 특기사항 초안을 생성합니다.
          </p>
          <span className="mt-8 inline-block rounded-lg bg-canvas px-6 py-3 text-[16px] font-medium text-ink">
            교사로 시작하기
          </span>
        </Link>

        <Link
          href="/student/login"
          className="block rounded-lg bg-forest p-8 text-white transition-opacity active:opacity-90"
        >
          <h2 className="text-[24px] leading-[1.3] text-white">학생</h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-white/85">
            오늘 참여한 활동의 소감을 남기고, 내가 쓴 기록을 다시 볼 수 있습니다.
          </p>
          <span className="mt-8 inline-block rounded-lg bg-canvas px-6 py-3 text-[16px] font-medium text-ink">
            학생으로 시작하기
          </span>
        </Link>
      </div>

      <p className="mt-16 text-[13px] leading-[1.7] text-muted">
        이 도구는 교사의 특기사항 작성을 돕는 보조 도구입니다. AI가 학생을 평가하거나 최종 기록을
        확정하지 않습니다.
      </p>
    </main>
  );
}
