import { normalizeGradeOrClass, normalizeSchoolName } from "./normalize";

/**
 * 가입 화면에 보여 줄 "이미 등록된 학급" 목록.
 *
 * 학생 가입은 교사가 등록한 학교명과 글자 단위로 정확히 맞아야 통과한다.
 * 2026-09-16 2학년 6반 담임이 학교명을 "경희여자중학"(교 빠짐)으로 등록해
 * 학생 24명 전원이 가입하지 못한 일이 있었다. 학교·학년·반을 타이핑하지 않고
 * 등록된 것 중에서 고르게 하면 학생 쪽 오타는 사라지고, 교사 쪽 오타도
 * 등록 화면에서 기존 학교명을 고르게 해서 막는다.
 *
 * 이 목록은 로그인 전에 보이므로 학교명·학년·반 번호만 담고 그 외는 담지 않는다.
 */
export interface RegisteredSchool {
  /** 화면에 보일 이름. 같은 학교의 첫 등록 표기를 쓴다. */
  name: string;
  /** 대조 키에 쓰이는 정규화 값 */
  key: string;
  classes: Array<{ grade: string; classNumber: string }>;
}

export interface ClassIdentityRow {
  schoolName: string;
  grade: string;
  classNumber: string;
}

/** 학급 문서들을 학교별로 묶고, 학년·반은 숫자 순으로 정렬한다. */
export function groupRegisteredClasses(rows: ClassIdentityRow[]): RegisteredSchool[] {
  const bySchool = new Map<string, RegisteredSchool>();
  for (const row of rows) {
    const key = normalizeSchoolName(row.schoolName);
    if (!key) continue;
    let school = bySchool.get(key);
    if (!school) {
      school = { name: row.schoolName.trim(), key, classes: [] };
      bySchool.set(key, school);
    }
    const grade = normalizeGradeOrClass(row.grade);
    const classNumber = normalizeGradeOrClass(row.classNumber);
    if (!school.classes.some((c) => c.grade === grade && c.classNumber === classNumber)) {
      school.classes.push({ grade, classNumber });
    }
  }

  const byNumber = (a: string, b: string) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, "ko");
  };

  const schools = Array.from(bySchool.values());
  for (const s of schools) {
    s.classes.sort((a, b) => byNumber(a.grade, b.grade) || byNumber(a.classNumber, b.classNumber));
  }
  schools.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return schools;
}

/** 한 학교 안에서 등록된 학년 목록 (중복 제거, 정렬 유지) */
export function gradesOf(school: RegisteredSchool | undefined): string[] {
  if (!school) return [];
  return Array.from(new Set(school.classes.map((c) => c.grade)));
}

/** 한 학교의 한 학년에 등록된 반 목록 */
export function classNumbersOf(school: RegisteredSchool | undefined, grade: string): string[] {
  if (!school) return [];
  return school.classes.filter((c) => c.grade === grade).map((c) => c.classNumber);
}
