"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { SetupNotice } from "@/components/ui/setup-notice";
import { Spinner } from "@/components/ui/surface";
import { cn, formatClassFull } from "@/lib/utils";

const NAV = [
  { href: "/teacher", label: "대시보드", exact: true },
  { href: "/teacher/students", label: "학급 학생" },
];

export default function TeacherAppLayout({ children }: { children: React.ReactNode }) {
  const { configured, loading, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const onboarding = pathname === "/teacher/onboarding";

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/teacher/login");
      return;
    }
    if (profile.role === "admin") {
      router.replace("/admin");
      return;
    }
    if (profile.role !== "teacher") {
      router.replace("/student");
      return;
    }
    // 학급 등록을 마치기 전에는 다른 교사 기능으로 가지 않는다.
    if (profile.needsOnboarding && !onboarding) {
      router.replace("/teacher/onboarding");
    } else if (!profile.needsOnboarding && onboarding) {
      router.replace("/teacher");
    }
  }, [loading, profile, onboarding, router]);

  if (!configured) return <SetupNotice />;
  if (loading || !profile || profile.role !== "teacher") return <Spinner />;
  if (profile.needsOnboarding !== onboarding) return <Spinner />;

  const klass = profile.klass;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-6">
          <Link href="/teacher" className="text-[15px] font-medium text-ink whitespace-nowrap">
            생기부 기록 도우미
          </Link>

          {!profile.needsOnboarding && (
            <nav className="hidden gap-5 sm:flex">
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-[14px]",
                      active ? "text-ink" : "text-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-4">
            {klass && (
              <span className="hidden text-[13px] text-muted md:inline">
                {formatClassFull(klass.schoolYear, klass.grade, klass.classNumber)} ·{" "}
                {klass.teacherName}
              </span>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace("/teacher/login");
              }}
              className="text-[13px] text-muted"
            >
              로그아웃
            </button>
          </div>
        </div>

        {!profile.needsOnboarding && (
          <nav className="flex gap-5 border-t border-hairline px-6 py-3 sm:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-[14px] text-body">
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="mx-auto max-w-[1180px] px-6 py-12">{children}</div>
    </div>
  );
}
