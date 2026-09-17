"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AuthShell, translateFirebaseAuthError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { SetupNotice } from "@/components/ui/setup-notice";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useRegisteredClasses } from "@/lib/client/use-registered-classes";
import { classNumbersOf, gradesOf } from "@/lib/roster/registered-classes";
import { clientAuth } from "@/lib/firebase/client";

const THIS_YEAR = String(new Date().getFullYear());

/**
 * 학생 회원가입.
 *
 * 학교명은 입력받지 않는다(한 학교 전용). 학년·반은 담임이 등록한 학급 목록에서 고른다.
 * 실패 문구는 가입 버튼 바로 옆에 띄우고 그 자리로 화면을 옮긴다 — 예전에는 폼 맨 위에
 * 떠서, 버튼을 누른 학생 눈에는 아무 일도 안 일어난 것처럼 보였다.
 */
export default function StudentSignupPage() {
  const { configured, refresh } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    schoolYear: THIS_YEAR,
    grade: "",
    classNumber: "",
    studentNumber: "",
    studentName: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const registered = useRegisteredClasses(form.schoolYear);
  const pickable = registered.status === "ready" && registered.classes.length > 0;
  const noneRegistered = registered.status === "ready" && registered.classes.length === 0;

  // 선택지가 하나뿐이면 고른 것으로 친다. 상태에 쓰지 않고 렌더마다 파생시키므로
  // 목록이 바뀌어도 어긋나지 않고, 제출할 때도 이 값을 보낸다.
  const grades = gradesOf(registered.classes);
  const grade = pickable
    ? grades.includes(form.grade)
      ? form.grade
      : grades.length === 1
        ? grades[0]
        : ""
    : form.grade;
  const classNumbers = classNumbersOf(registered.classes, grade);
  const classNumber = pickable
    ? classNumbers.includes(form.classNumber)
      ? form.classNumber
      : classNumbers.length === 1
        ? classNumbers[0]
        : ""
    : form.classNumber;

  if (!configured) return <SetupNotice />;

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function showError(message: string) {
    setError(message);
    // 렌더가 끝난 뒤 문구 자리로 옮긴다. 버튼 바로 위라 대개 이미 보이지만,
    // 작은 화면에서 키보드가 올라와 있으면 가려질 수 있다.
    requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/student-signup", {
        method: "POST",
        body: JSON.stringify({ ...form, grade, classNumber }),
      });
      await signInWithEmailAndPassword(clientAuth(), form.email.trim().toLowerCase(), form.password);
      await refresh();
      router.replace("/student");
    } catch (err) {
      showError(
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
      description="담임 선생님이 미리 등록한 우리 반 명단과 연결됩니다. 번호와 이름은 명단에 있는 그대로 입력해주세요."
    >
      <form onSubmit={onSubmit} noValidate>
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

        {noneRegistered && (
          <Alert tone="info">
            {form.schoolYear}학년도에 등록된 학급이 아직 없습니다. 담임 선생님이 학급을 등록한 뒤에
            가입할 수 있습니다.
          </Alert>
        )}

        {pickable ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="학년" htmlFor="grade">
              <Select
                id="grade"
                value={grade}
                onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value, classNumber: "" }))}
                required
              >
                <option value="">선택</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}학년
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="반"
              htmlFor="classNumber"
              hint={
                grade && classNumbers.length === 0
                  ? `${grade}학년에 등록된 반이 아직 없습니다.`
                  : undefined
              }
            >
              <Select
                id="classNumber"
                value={classNumber}
                onChange={update("classNumber")}
                disabled={!grade}
                required
              >
                <option value="">선택</option>
                {classNumbers.map((c) => (
                  <option key={c} value={c}>
                    {c}반
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="학년"
              htmlFor="grade"
              hint={registered.status === "loading" ? "등록된 학급을 불러오는 중…" : undefined}
            >
              <Input
                id="grade"
                inputMode="numeric"
                value={form.grade}
                onChange={update("grade")}
                placeholder="3"
                required
              />
            </Field>
            <Field label="반" htmlFor="classNumber">
              <Input
                id="classNumber"
                inputMode="numeric"
                value={form.classNumber}
                onChange={update("classNumber")}
                placeholder="2"
                required
              />
            </Field>
          </div>
        )}
        {pickable && (
          <p className="-mt-2 mb-4 text-[13px] text-muted">
            목록에 우리 반이 없으면 담임 선생님이 아직 학급을 등록하지 않은 것입니다. 선생님께
            알려주세요.
          </p>
        )}

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

        {/* 실패 문구는 버튼 바로 위. 학생이 보고 있는 자리다. */}
        {error && (
          <div ref={errorRef}>
            <Alert>{error}</Alert>
          </div>
        )}

        <Button type="submit" loading={busy} disabled={noneRegistered} className="mt-2 w-full">
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
