import type { ReflectionSource } from "@/lib/types";

export interface MergedReflection {
  /** 최종적으로 쓸 기록. 교사 보완본이 있으면 그것, 없으면 학생 원문 */
  reflection: string;
  /** 학생이 직접 쓴 원문 (없으면 빈 문자열) */
  studentOriginal: string;
  hasReflection: boolean;
  source: ReflectionSource;
}

/**
 * 학생 원문(responses)과 교사 보완본(teacherNotes)을 합쳐 최종 기록을 만든다.
 *
 * 교사 보완본이 있으면 그것이 최종 자료가 되지만, 학생 원문은 지우지 않고 그대로 남긴다.
 * 학생 화면에는 언제나 원문만 보이고, 교사 화면과 AI 생성에는 이 최종 기록이 쓰인다.
 */
export function mergeReflection(studentText: string, teacherText: string): MergedReflection {
  const studentOriginal = (studentText ?? "").trim();
  const edited = (teacherText ?? "").trim();
  const reflection = edited || studentOriginal;

  const source: ReflectionSource = edited
    ? studentOriginal
      ? "teacher-edited"
      : "teacher"
    : studentOriginal
      ? "student"
      : "none";

  return {
    reflection,
    studentOriginal,
    hasReflection: reflection.length > 0,
    source,
  };
}
