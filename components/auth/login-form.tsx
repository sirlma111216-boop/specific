"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth, type Profile } from "@/lib/client/auth-context";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { translateFirebaseAuthError } from "./auth-shell";
import type { Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = { teacher: "교사", student: "학생" };

export function LoginForm({ role, redirectTo }: { role: Role; redirectTo: string }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(clientAuth(), email.trim().toLowerCase(), password);
      const profile = await apiFetch<Profile>("/api/me");
      // 학생 화면과 교사 화면은 완전히 분리한다. 역할이 다르면 로그인시키지 않는다.
      if (profile.role !== role) {
        await signOut(clientAuth());
        setError(
          `${ROLE_LABEL[profile.role]} 계정입니다. ${ROLE_LABEL[profile.role]} 로그인 화면을 이용해주세요.`,
        );
        return;
      }
      await refresh();
      router.replace(redirectTo);
    } catch (err) {
      setError(
        (err as { code?: string })?.code
          ? translateFirebaseAuthError(err)
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && <Alert>{error}</Alert>}
      <Field label="이메일" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@school.kr"
          required
        />
      </Field>
      <Field label="비밀번호" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" loading={busy} className="mt-2 w-full">
        로그인
      </Button>
    </form>
  );
}
