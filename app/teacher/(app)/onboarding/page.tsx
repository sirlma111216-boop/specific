"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/surface";
import { emptyRows, RosterEditor, type RosterRow } from "@/components/roster/roster-editor";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useRegisteredClasses } from "@/lib/client/use-registered-classes";
import { formatClassName } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState({
    schoolYear: String(new Date().getFullYear()),
    grade: "",
    classNumber: "",
    teacherName: profile?.klass?.teacherName ?? "",
  });
  const [rows, setRows] = useState<RosterRow[]>(emptyRows(5));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 이미 등록된 학급과 겹치면 제출 전에 알린다. (서버도 막지만, 입력 중에 아는 편이 낫다)
  const registered = useRegisteredClasses(form.schoolYear);
  const gradeKey = (form.grade.match(/d+/) ?? [""])[0];
  const classKey = (form.classNumber.match(/d+/) ?? [""])[0];
  const alreadyRegistered =
    registered.status === "ready" &&
    gradeKey !== "" &&
    classKey !== "" &&
    registered.classes.some((c) => c.grade === String(Number(gradeKey)) && c.classNumber === String(Number(classKey)));

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const students = rows
        .filter((r) => r.studentName.trim() !== "" || r.studentNumber.trim() !== "")
        .map((r) => ({ studentNumber: r.studentNumber, studentName: r.studentName }));
      if (students.length === 0) {
        setError("학생을 한 명 이상 등록해주세요.");
        return;
      }
      await apiFetch("/api/teacher/class", {
        method: "POST",
        body: JSON.stringify({ ...form, students }),
      });
      await refresh();
      router.replace("/teacher");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="mb-10 max-w-[640px]">
        <p className="mb-3 text-[14px] font-medium tracking-[0.16px] text-muted">최초 설정</p>
        <h1 className="text-[32px] leading-[1.2] text-ink">우리 반 등록하기</h1>
        <p className="prose-ko mt-3 text-[14px] text-muted">
          학급 정보와 학생 명단을 먼저 등록해야 합니다. 여기서 등록한 정보로 학생들이 회원가입할 때
          본인 계정과 명단이 연결됩니다.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={onSubmit}>
        <Card className="mb-8">
          <h2 className="mb-6 text-[20px] text-ink">학급 정보</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="학년도" htmlFor="schoolYear" hint="예: 2026">
              <Input
                id="schoolYear"
                inputMode="numeric"
                value={form.schoolYear}
                onChange={update("schoolYear")}
                required
              />
            </Field>
            <Field label="학년" htmlFor="grade" hint="예: 3">
              <Input
                id="grade"
                inputMode="numeric"
                value={form.grade}
                onChange={update("grade")}
                required
              />
            </Field>
            <Field
              label="반"
              htmlFor="classNumber"
              hint="예: 2"
              error={
                alreadyRegistered
                  ? `${formatClassName(gradeKey, classKey)}은(는) 이미 다른 선생님이 등록했습니다.`
                  : undefined
              }
            >
              <Input
                id="classNumber"
                inputMode="numeric"
                value={form.classNumber}
                onChange={update("classNumber")}
                required
              />
            </Field>
            <Field label="담임교사 이름" htmlFor="teacherName" hint="예: 홍길동">
              <Input
                id="teacherName"
                value={form.teacherName}
                onChange={update("teacherName")}
                required
              />
            </Field>
          </div>
          <p className="prose-ko rounded-md bg-cream px-4 py-3 text-[13px] text-ink">
            학생은 회원가입할 때 여기 등록한 <strong>학년 · 반</strong>을 목록에서 고르고, 명단의{" "}
            <strong>번호 · 이름</strong>을 입력해 연결됩니다. 이름은 학생이 평소 쓰는 표기 그대로
            적어주세요.
          </p>
        </Card>

        <Card className="mb-8">
          <h2 className="mb-2 text-[20px] text-ink">학생 등록</h2>
          <p className="mb-6 text-[14px] text-muted">
            한 명씩 직접 입력하거나, 엑셀 파일로 한 번에 올릴 수 있습니다.
          </p>
          <RosterEditor rows={rows} onChange={setRows} />
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            학급 등록하고 시작하기
          </Button>
        </div>
      </form>
    </main>
  );
}
