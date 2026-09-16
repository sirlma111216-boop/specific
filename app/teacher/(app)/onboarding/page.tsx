"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/surface";
import { emptyRows, RosterEditor, type RosterRow } from "@/components/roster/roster-editor";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { useAuth } from "@/lib/client/auth-context";
import { useRegisteredClasses } from "@/lib/client/use-registered-classes";

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState({
    schoolYear: String(new Date().getFullYear()),
    schoolName: "",
    grade: "",
    classNumber: "",
    teacherName: profile?.klass?.teacherName ?? "",
  });
  const [rows, setRows] = useState<RosterRow[]>(emptyRows(5));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 같은 학교의 다른 반이 이미 등록돼 있으면 그 학교명을 고르게 한다.
  // 학교명이 글자 하나만 달라도(예: '경희여자중학') 그 반 학생은 아무도 가입하지 못한다.
  const registered = useRegisteredClasses(form.schoolYear);
  const knownSchools = registered.status === "ready" ? registered.schools : [];
  const [customSchool, setCustomSchool] = useState(false);
  const useSelect = knownSchools.length > 0 && !customSchool;

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
            {useSelect ? (
              <Field
                label="학교명"
                htmlFor="schoolName"
                hint="이미 등록된 학교입니다. 다른 학교라면 '직접 입력'을 고르세요."
              >
                <Select
                  id="schoolName"
                  value={form.schoolName}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomSchool(true);
                      setForm((p) => ({ ...p, schoolName: "" }));
                    } else {
                      setForm((p) => ({ ...p, schoolName: e.target.value }));
                    }
                  }}
                  required
                >
                  <option value="">선택하세요</option>
                  {knownSchools.map((x) => (
                    <option key={x.key} value={x.name}>
                      {x.name} (등록된 학급 {x.classes.length}개)
                    </option>
                  ))}
                  <option value="__custom__">다른 학교 — 직접 입력</option>
                </Select>
              </Field>
            ) : (
              <Field
                label="학교명"
                htmlFor="schoolName"
                hint={
                  knownSchools.length > 0
                    ? "학생이 가입할 때 이 이름을 고르게 됩니다. 정식 명칭을 정확히 적어주세요."
                    : "예: ○○중학교 — 학생이 가입할 때 이 이름을 고르게 됩니다."
                }
              >
                <Input
                  id="schoolName"
                  value={form.schoolName}
                  onChange={update("schoolName")}
                  required
                />
                {knownSchools.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCustomSchool(false)}
                    className="mt-1.5 text-[13px] text-link underline underline-offset-2"
                  >
                    등록된 학교에서 고르기
                  </button>
                )}
              </Field>
            )}
            <Field label="학년" htmlFor="grade" hint="예: 3학년">
              <Input id="grade" value={form.grade} onChange={update("grade")} required />
            </Field>
            <Field label="반" htmlFor="classNumber" hint="예: 2반">
              <Input
                id="classNumber"
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
            학생은 회원가입할 때 여기 등록한 <strong>학교명 · 학년 · 반</strong>을 목록에서 고르고
            명단의 <strong>번호 · 이름</strong>을 입력해 연결됩니다. 학교명은 다른 반과 똑같이 적어야
            학생이 헷갈리지 않습니다.
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
