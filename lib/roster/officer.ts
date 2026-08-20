import { formatRecordDate } from "@/lib/utils";

/**
 * 자치활동 임원 재임 표기.
 *
 * 학교생활기록부 기재요령:
 *  "자치활동 관련 내용을 특기사항에 입력할 때는 구체적인 임원의 종류를 알 수 있도록
 *   '전교', '학년', '학급' 등을 입력하고, 재임기간을 ( )안에 병기한다."
 *  〈예시〉1학기 전교 학생자치회 부회장(2026.03.01.-2026.08.18.)
 *         전교 학생자치회 회장(2026.03.01.-2027.02.03.)   ← 학년 단위는 학기 표기 없음
 */

export type OfficerScope = "class" | "grade" | "school";
export type OfficerRole = "president" | "vicePresident";
/** 학기 단위 선출이면 first/second, 학년(졸업일까지) 단위면 year */
export type OfficerTermPeriod = "first" | "second" | "year";

export interface OfficerTerm {
  period: OfficerTermPeriod;
  scope: OfficerScope;
  role: OfficerRole;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
}

export const OFFICER_PERIOD_LABEL: Record<OfficerTermPeriod, string> = {
  first: "1학기",
  second: "2학기",
  year: "학년 전체",
};

export const OFFICER_SCOPE_LABEL: Record<OfficerScope, string> = {
  class: "학급",
  grade: "학년",
  school: "전교",
};

export const OFFICER_ROLE_LABEL: Record<OfficerRole, string> = {
  president: "회장",
  vicePresident: "부회장",
};

/**
 * 임원 직위 이름.
 * 학급은 '학급회장'처럼 붙여 쓰고, 학년·전교는 '학생자치회'를 넣는 것이 기재요령 예시다.
 */
function positionName(scope: OfficerScope, role: OfficerRole): string {
  const roleLabel = OFFICER_ROLE_LABEL[role];
  if (scope === "class") return `학급${roleLabel}`;
  return `${OFFICER_SCOPE_LABEL[scope]} 학생자치회 ${roleLabel}`;
}

/** "1학기 학급회장(2026.03.01.-2026.08.18.)" */
export function formatOfficerTerm(term: OfficerTerm): string {
  const position = positionName(term.scope, term.role);
  const prefix = term.period === "year" ? "" : `${OFFICER_PERIOD_LABEL[term.period]} `;
  const period = `${formatRecordDate(term.startDate)}-${formatRecordDate(term.endDate)}`;
  return `${prefix}${position}(${period})`;
}

export function formatOfficerTerms(terms: OfficerTerm[]): string[] {
  return terms.filter(isCompleteOfficerTerm).map(formatOfficerTerm);
}

/** 네 항목이 모두 채워진 경우에만 기록으로 인정한다. */
export function isCompleteOfficerTerm(term: Partial<OfficerTerm> | null | undefined): term is OfficerTerm {
  if (!term) return false;
  return Boolean(term.period && term.scope && term.role && term.startDate && term.endDate);
}

export const MAX_OFFICER_TERMS = 3;
