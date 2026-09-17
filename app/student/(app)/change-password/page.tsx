"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/surface";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { clientAuth } from "@/lib/firebase/client";

/**
 * 새 비밀번호 정하기.
 * 담임이 초기화한 비밀번호로 들어온 학생은 이 화면부터 본다. 정하기 전에는 다른 화면으로 못 간다.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { profile, refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forced = Boolean(profile?.mustChangePassword);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("두 비밀번호가 서로 다릅니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/student/change-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      // 서버가 비밀번호를 바꾸면 지금 세션의 토큰이 곧 만료될 수 있어 새 비밀번호로 다시 로그인한다.
      if (profile?.email) {
        await signInWithEmailAndPassword(clientAuth(), profile.email, password);
      }
      await refresh();
      router.replace("/student");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <Card>
        <h1 className="text-[24px] leading-[1.3] text-ink">새 비밀번호 정하기</h1>
        <p className="prose-ko mt-3 text-[14px] text-muted">
          {forced
            ? "담임 선생님이 비밀번호를 초기화했습니다. 앞으로 쓸 비밀번호를 정해야 다음 화면으로 갈 수 있습니다."
            : "앞으로 쓸 새 비밀번호를 정합니다."}
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8">
          {error && <Alert>{error}</Alert>}
          <Field label="새 비밀번호" htmlFor="pw" hint="6자 이상. 초기화 비밀번호와 달라야 합니다.">
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="새 비밀번호 확인" htmlFor="pw2">
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" loading={busy} className="mt-2 w-full">
            비밀번호 정하기
          </Button>
        </form>
      </Card>
    </main>
  );
}
