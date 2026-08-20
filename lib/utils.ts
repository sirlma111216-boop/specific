/** 클래스명 병합. tailwind-merge 없이도 충분한 최소 구현. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * 생기부 글자 수 = 공백 포함 문자 수.
 * 한글/이모지 surrogate pair를 1자로 세기 위해 code point 기준으로 센다.
 */
export function countCharacters(text: string): number {
  return Array.from(text ?? "").length;
}

/** 한국 표준시 기준 오늘 날짜(YYYY-MM-DD). 서버가 UTC여도 학교 날짜와 어긋나지 않게 한다. */
export function todayInKST(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → 2026.08.20 */
export function formatDateDots(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${y}.${m}.${d}`;
}

/**
 * 생활기록부 표기용 날짜: YYYY-MM-DD → 2026.08.19.
 * 기재요령의 관례대로 끝에 마침표를 붙인다. (예: 학교폭력예방교육(2026.03.04.))
 */
export function formatRecordDate(isoDate: string): string {
  const [y, m, d] = (isoDate ?? "").split("-");
  if (!y || !m || !d) return isoDate ?? "";
  return `${y}.${m}.${d}.`;
}

/** YYYY-MM-DD → 08.20 */
export function formatDateShort(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${m}.${d}`;
}

/**
 * 학급 표기.
 *
 * 교사가 "3"이라고만 입력했으면 "3학년"으로 채워서 보여주고,
 * "3학년"이라고 입력했으면 그대로 둔다. (단위를 두 번 붙이지 않는다)
 */
export function formatGrade(grade: string): string {
  const g = (grade ?? "").trim();
  return /^\d+$/.test(g) ? `${g}학년` : g;
}

export function formatClassNumber(classNumber: string): string {
  const c = (classNumber ?? "").trim();
  return /^\d+$/.test(c) ? `${c}반` : c;
}

/** "3학년 1반" */
export function formatClassName(grade: string, classNumber: string): string {
  return [formatGrade(grade), formatClassNumber(classNumber)].filter(Boolean).join(" ");
}

/** "2026학년도" */
export function formatSchoolYear(schoolYear: number | string): string {
  const y = String(schoolYear ?? "").trim();
  return y ? `${y}학년도` : "";
}

/** "2026학년도 3학년 1반" */
export function formatClassFull(
  schoolYear: number | string,
  grade: string,
  classNumber: string,
): string {
  return [formatSchoolYear(schoolYear), formatClassName(grade, classNumber)]
    .filter(Boolean)
    .join(" ");
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
