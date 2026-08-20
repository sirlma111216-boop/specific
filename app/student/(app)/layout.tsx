"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { SetupNotice } from "@/components/ui/setup-notice";
import { Spinner } from "@/components/ui/surface";

export default function StudentAppLayout({ children }: { children: React.ReactNode }) {
  const { configured, loading, profile, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/student/login");
      return;
    }
    if (profile.role !== "student") router.replace("/teacher");
  }, [loading, profile, router]);

  if (!configured) return <SetupNotice />;
  if (loading || !profile || profile.role !== "student") return <Spinner />;

  return (
    <div className="min-h-dvh">
      {/* 학생 화면은 모바일 퍼스트. 헤더는 최소한만 둔다. */}
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-4 px-5">
          <Link href="/student" className="text-[15px] font-medium text-ink">
            내 활동 기록
          </Link>
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
      <div className="mx-auto max-w-[640px] px-5 py-8">{children}</div>
    </div>
  );
}
