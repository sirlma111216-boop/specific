"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { SetupNotice } from "@/components/ui/setup-notice";
import { Spinner } from "@/components/ui/surface";
import { useAuth } from "@/lib/client/auth-context";

export default function TeacherLoginPage() {
  const { configured, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile?.role === "teacher") router.replace("/teacher");
  }, [loading, profile, router]);

  if (!configured) return <SetupNotice />;
  if (loading) return <Spinner />;

  return (
    <AuthShell eyebrow="교사" title="로그인">
      <LoginForm role="teacher" redirectTo="/teacher" />
      <p className="mt-8 text-[14px] text-muted">
        아직 계정이 없으신가요?{" "}
        <Link href="/teacher/signup" className="text-link underline underline-offset-2">
          교사 회원가입
        </Link>
      </p>
    </AuthShell>
  );
}
