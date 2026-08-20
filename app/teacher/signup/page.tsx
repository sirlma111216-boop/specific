"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AuthShell, translateFirebaseAuthError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { SetupNotice } from "@/components/ui/setup-notice";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { clientAuth } from "@/lib/firebase/client";

export default function TeacherSignupPage() {
  const { configured, refresh } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", teacherName: "", code: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!configured) return <SetupNotice />;

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/teacher-signup", {
        method: "POST",
        body: JSON.stringify(form),
      });
      // 가입 직후 바로 로그인시켜 온보딩(학급 등록)으로 보낸다.
      await signInWithEmailAndPassword(clientAuth(), form.email.trim().toLowerCase(), form.password);
      await refresh();
      router.replace("/teacher/onboarding");
    } catch (err) {
      setError(
        (err as { code?: string })?.code?.startsWith("auth/")
          ? translateFirebaseAuthError(err)
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="교사"
      title="회원가입"
      description="학생이 임의로 교사 계정을 만들 수 없도록, 학교에서 안내받은 교사용 가입 코드가 필요합니다."
    >
      <form onSubmit={onSubmit} noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="이메일" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            placeholder="name@school.kr"
            required
          />
        </Field>
        <Field label="비밀번호" htmlFor="password" hint="6자 이상">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update("password")}
            required
          />
        </Field>
        <Field label="이름" htmlFor="teacherName">
          <Input
            id="teacherName"
            value={form.teacherName}
            onChange={update("teacherName")}
            placeholder="홍길동"
          />
        </Field>
        <Field label="교사용 가입 코드" htmlFor="code">
          <Input id="code" value={form.code} onChange={update("code")} required />
        </Field>
        <Button type="submit" loading={busy} className="mt-2 w-full">
          가입하기
        </Button>
      </form>
      <p className="mt-8 text-[14px] text-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/teacher/login" className="text-link underline underline-offset-2">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
