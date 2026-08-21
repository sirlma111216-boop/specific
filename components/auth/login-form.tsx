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

const ROLE_LABEL: Record<Role, string> = { admin: "관리자", teacher: "교사", student: "학생" };

export function LoginForm({ role, redirectTo }: { role: Role; redirectTo: string }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * 관리자는 회원가입을 하지 않고 지정된 계정으로만 들어온다.
   * 계정이 아직 없으면 로그인이 실패하므로, 그때만 서버에 계정 준비를 요청하고 다시 시도한다.
   * 교사·학생 로그인에는 영향이 없다.
   */
  async function signInAllowingAdminBootstrap(mail: string, pw: string) {
    try {
      await signInWithEmailAndPassword(clientAuth(), mail, pw);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      const notFound =
        code === "auth/user-not-found" || code === "auth/invalid-credential";
      if (!notFound) throw err;
      await apiFetch("/api/auth/admin-bootstrap", {
        method: "POST",
        body: JSON.stringify({ email: mail, password: pw }),
      });
      await signInWithEmailAndPassword(clientAuth(), mail, pw);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const mail = email.trim().toLowerCase();
    try {
      await signInAllowingAdminBootstrap(mail, password);
      const profile = await apiFetch<Profile>("/api/me");

      // 관리자는 교사 로그인 화면으로 들어오지만 관리자 화면으로 보낸다.
      if (profile.role === "admin") {
        await refresh();
        router.replace("/admin");
        return;
      }

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
