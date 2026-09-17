import { normalizeGradeOrClass } from "./normalize";

/**
 * 가입 화면에 보여 줄 "이미 등록된 학급" 목록.
 *
 * 학생은 학년·반을 타이핑하지 않고 이 목록에서 고른다. 목록에 우리 반이 없으면
 * 담임이 아직 학급을 등록하지 않은 것이므로 화면이 그렇게 알려 준다.
 * 로그인 전에 보이는 목록이라 학년·반 번호만 담고 그 외(교사 이름, 인원 등)는 담지 않는다.
 */
export interface RegisteredClass {
  grade: string;
  classNumber: string;
}

/** 학급 문서들에서 학년·반을 뽑아 중복을 없애고 숫자 순으로 정렬한다. */
export function listRegisteredClasses(
  rows: Array<{ grade: string; classNumber: string }>,
): RegisteredClass[] {
  const out: RegisteredClass[] = [];
  for (const row of rows) {
    const grade = normalizeGradeOrClass(row.grade);
    const classNumber = normalizeGradeOrClass(row.classNumber);
    if (!grade || !classNumber) continue;
    if (!out.some((c) => c.grade === grade && c.classNumber === classNumber)) {
      out.push({ grade, classNumber });
    }
  }
  const byNumber = (a: string, b: string) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, "ko");
  };
  out.sort((a, b) => byNumber(a.grade, b.grade) || byNumber(a.classNumber, b.classNumber));
  return out;
}

/** 등록된 학년 목록 (중복 제거, 정렬 유지) */
export function gradesOf(classes: RegisteredClass[]): string[] {
  return Array.from(new Set(classes.map((c) => c.grade)));
}

/** 한 학년에 등록된 반 목록 */
export function classNumbersOf(classes: RegisteredClass[], grade: string): string[] {
  return classes.filter((c) => c.grade === grade).map((c) => c.classNumber);
}
