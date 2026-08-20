/**
 * 학급·학생 매칭용 정규화.
 *
 * 원칙: "서울중학교"와 "서울 중학교"처럼 불필요한 공백 차이만 흡수한다.
 * 유사도(fuzzy) 매칭은 다른 학생과 잘못 연결될 위험이 있으므로 절대 하지 않는다.
 * - 자모 조합 차이(NFC/NFD)는 같은 글자이므로 NFC로 통일한다.
 * - 공백/전각공백은 제거한다.
 * - 그 외 글자는 단 한 글자도 바꾸거나 버리지 않는다.
 */

const WHITESPACE = /[\s\u00a0\u3000]+/g;

export function normalizeText(value: string): string {
  return (value ?? "").normalize("NFC").replace(WHITESPACE, "");
}

/** 학교명: 공백 제거 + 영문 대소문자 통일. 약칭(○○중 ↔ ○○중학교) 매칭은 하지 않는다. */
export function normalizeSchoolName(value: string): string {
  return normalizeText(value).toLowerCase();
}

/**
 * 학년/반: "3", "3학년", "3 학년", "03" 을 모두 "3"으로 맞춘다.
 * 숫자가 없으면(예: "가온반") 공백만 제거한 문자열을 그대로 쓴다.
 */
export function normalizeGradeOrClass(value: string): string {
  const cleaned = normalizeText(value);
  const digits = cleaned.match(/\d+/);
  if (digits) return String(Number(digits[0]));
  return cleaned.toLowerCase();
}

/** 학생 이름: 공백만 제거. 이름은 어떤 유사도 보정도 하지 않는다. */
export function normalizeStudentName(value: string): string {
  return normalizeText(value);
}

export interface ClassIdentity {
  schoolYear: number;
  schoolName: string;
  grade: string;
  classNumber: string;
}

/** 학급을 특정하는 정규화 키. 학생 가입 시 이 키로 학급을 찾는다. */
export function buildClassMatchKey(identity: ClassIdentity): string {
  return [
    String(identity.schoolYear),
    normalizeSchoolName(identity.schoolName),
    normalizeGradeOrClass(identity.grade),
    normalizeGradeOrClass(identity.classNumber),
  ].join("|");
}
