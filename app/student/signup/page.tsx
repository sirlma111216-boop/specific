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

const THIS_YEAR = String(new Date().getFullYear());

export default function StudentSignupPage() {
  const { configured, refresh } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    schoolYear: THIS_YEAR,
    schoolName: "",
    grade: "",
    classNumber: "",
    studentNumber: "",
    studentName: "",
  });
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
      await apiFetch("/api/auth/student-signup", { method: "POST", body: JSON.stringify(form) });
      await signInWithEmailAndPassword(clientAuth(), form.email.trim().toLowerCase(), form.password);
      await refresh();
      router.replace("/student");
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
      eyebrow="학생"
      title="회원가입"
      description="담임 선생님이 미리 등록한 우리 반 명단과 연결됩니다. 명단에 있는 정보 그대로 입력해주세요."
    >
      <form onSubmit={onSubmit} noValidate>
        {error && <Alert>{error}</Alert>}

        <Field label="이메일" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={update("email")}
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

        <div className="my-8 h-px bg-hairline" />

        <Field label="학년도" htmlFor="schoolYear">
          <Input
            id="schoolYear"
            inputMode="numeric"
            value={form.schoolYear}
            onChange={update("schoolYear")}
            placeholder="2026"
            required
          />
        </Field>
        <Field label="학교명" htmlFor="schoolName">
          <Input
            id="schoolName"
            value={form.schoolName}
            onChange={update("schoolName")}
            placeholder="○○중학교"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="학년" htmlFor="grade">
            <Input
              id="grade"
              value={form.grade}
              onChange={update("grade")}
              placeholder="3학년"
              required
            />
          </Field>
          <Field label="반" htmlFor="classNumber">
            <Input
              id="classNumber"
              value={form.classNumber}
              onChange={update("classNumber")}
              placeholder="2반"
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="번호" htmlFor="studentNumber">
            <Input
              id="studentNumber"
              inputMode="numeric"
              value={form.studentNumber}
              onChange={update("studentNumber")}
              placeholder="5"
              required
            />
          </Field>
          <Field label="이름" htmlFor="studentName">
            <Input
              id="studentName"
              value={form.studentName}
              onChange={update("studentName")}
              placeholder="김민서"
              required
            />
          </Field>
        </div>

        <Button type="submit" loading={busy} className="mt-2 w-full">
          가입하기
        </Button>
      </form>
      <p className="mt-8 text-[14px] text-muted">
        이미 가입했나요?{" "}
        <Link href="/student/login" className="text-link underline underline-offset-2">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
