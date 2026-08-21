"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/client/auth-context";
import { SetupNotice } from "@/components/ui/setup-notice";
import { Spinner } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "대시보드", exact: true },
  { href: "/admin/events", label: "자율·진로 활동" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { configured, loading, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/teacher/login");
      return;
    }
    // 관리자 화면은 지정된 관리자 계정만 들어온다.
    if (profile.role !== "admin") {
      router.replace(profile.role === "teacher" ? "/teacher" : "/student");
    }
  }, [loading, profile, router]);

  if (!configured) return <SetupNotice />;
  if (loading || !profile || profile.role !== "admin") return <Spinner />;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-6">
          <Link href="/admin" className="text-[15px] font-medium text-ink whitespace-nowrap">
            생기부 기록 도우미
          </Link>
          <span className="rounded-sm bg-coral px-2 py-0.5 text-[12px] font-medium text-white">
            관리자
          </span>

          <nav className="hidden gap-5 sm:flex">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("text-[14px]", active ? "text-ink" : "text-muted")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.replace("/teacher/login");
            }}
            className="ml-auto text-[13px] text-muted"
          >
            로그아웃
          </button>
        </div>

        <nav className="flex gap-5 border-t border-hairline px-6 py-3 sm:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-[14px] text-body">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1180px] px-6 py-12">{children}</div>
    </div>
  );
}
