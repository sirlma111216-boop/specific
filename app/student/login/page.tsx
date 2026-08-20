"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { SetupNotice } from "@/components/ui/setup-notice";
import { Spinner } from "@/components/ui/surface";
import { useAuth } from "@/lib/client/auth-context";

export default function StudentLoginPage() {
  const { configured, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile?.role === "student") router.replace("/student");
  }, [loading, profile, router]);

  if (!configured) return <SetupNotice />;
  if (loading) return <Spinner />;

  return (
    <AuthShell eyebrow="학생" title="로그인">
      <LoginForm role="student" redirectTo="/student" />
      <p className="mt-8 text-[14px] text-muted">
        처음이신가요?{" "}
        <Link href="/student/signup" className="text-link underline underline-offset-2">
          학생 회원가입
        </Link>
      </p>
    </AuthShell>
  );
}
