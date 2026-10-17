"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { LabbitoryLink } from "@/components/ui/labbitory-link";
import { SetupNotice } from "@/components/ui/setup-notice";
import { Spinner } from "@/components/ui/surface";
import { formatClassName } from "@/lib/utils";

export default function StudentAppLayout({ children }: { children: React.ReactNode }) {
  const { configured, loading, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const changing = pathname === "/student/change-password";

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/student/login");
      return;
    }
    if (profile.role !== "student") {
      router.replace("/teacher");
      return;
    }
    // 담임이 초기화한 비밀번호로 들어온 학생은 새 비밀번호를 정하기 전까지 다른 화면으로 못 간다.
    if (profile.mustChangePassword && !changing) router.replace("/student/change-password");
  }, [loading, profile, changing, router]);

  if (!configured) return <SetupNotice />;
  if (loading || !profile || profile.role !== "student") return <Spinner />;
  if (profile.mustChangePassword && !changing) return <Spinner />;

  return (
    <div className="flex-1">
      {/* 학생 화면은 모바일 퍼스트. 헤더는 최소한만 둔다. */}
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-4 px-5">
          <div className="flex items-center gap-2.5">
            <LabbitoryLink size={28} />
            <Link href="/student" className="text-[15px] font-medium text-ink">
              내 활동 기록
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/student/records" className="text-[13px] text-muted">
              지난 기록
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace("/student/login");
              }}
              className="text-[13px] text-muted"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/*
        지금 로그인한 사람이 누구인지 늘 보이게 한다.
        한 대의 기기를 여럿이 쓰다 앞사람 계정이 남아 있으면, 쓴 글이 그 사람 기록으로 저장된다.
        실제로 그렇게 들어간 기록이 있어, 담임 화면에서는 제출이 안 된 것처럼 보였다.
      */}
      {profile.student && (
        <div className="border-b border-hairline bg-cream">
          <p className="prose-ko mx-auto max-w-[640px] px-5 py-2.5 text-[13px] text-ink">
            <strong className="font-medium">
              {profile.klass ? `${formatClassName(profile.klass.grade, profile.klass.classNumber)} ` : ""}
              {profile.student.studentNumber}번 {profile.student.studentName}
            </strong>
            님으로 로그인했습니다. 내 이름이 아니면{" "}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace("/student/login");
              }}
              className="underline underline-offset-2"
            >
              로그아웃
            </button>
            한 뒤 내 아이디로 다시 들어와 주세요.
          </p>
        </div>
      )}

      <div className="mx-auto max-w-[640px] px-5 py-8">{children}</div>
    </div>
  );
}
