import { formatRecordDate } from "@/lib/utils";

/**
 * 자치활동 임원 재임 표기.
 *
 * 학교생활기록부 기재요령:
 *  "자치활동 관련 내용을 특기사항에 입력할 때는 구체적인 임원의 종류를 알 수 있도록
 *   '전교', '학년', '학급' 등을 입력하고, 재임기간을 ( )안에 병기한다."
 *  〈예시〉1학기 학급회장(2026.03.01.-2026.08.18.)
 *
 * 전교 회장·부회장은 여기서 다루지 않는다. 학생회 기록이라 담임이 아닌 담당 교사가
 * 관리하며, 그런 활동은 '활동 입력'의 개인 활동 기록으로 들어온다.
 */

export type OfficerRole = "president" | "vicePresident";
export type OfficerTermPeriod = "first" | "second";

export interface OfficerTerm {
  period: OfficerTermPeriod;
  role: OfficerRole;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  /** 어떤 리더십을 보였는지 담임이 적는 한 줄. 특기사항 문장이 아니라 근거 메모다. */
  note?: string;
}

export const OFFICER_PERIOD_LABEL: Record<OfficerTermPeriod, string> = {
  first: "1학기",
  second: "2학기",
};

export const OFFICER_ROLE_LABEL: Record<OfficerRole, string> = {
  president: "회장",
  vicePresident: "부회장",
};

/** 리더십 메모 길이. 한 줄이면 충분하다. */
export const MAX_OFFICER_NOTE_LENGTH = 100;

/** "1학기 학급회장(2026.03.01.-2026.08.18.)" */
export function formatOfficerTerm(term: OfficerTerm): string {
  const position = `학급${OFFICER_ROLE_LABEL[term.role] ?? OFFICER_ROLE_LABEL.president}`;
  // 예전 자료에 다른 임기 값이 남아 있어도 "undefined 학급회장"이 되지 않게 한다.
  const label = OFFICER_PERIOD_LABEL[term.period];
  const prefix = label ? `${label} ` : "";
  const period = `${formatRecordDate(term.startDate)}-${formatRecordDate(term.endDate)}`;
  return `${prefix}${position}(${period})`;
}

/** 생성에 넘길 표기 + 리더십 메모 */
export interface OfficerTermForRecord {
  term: string;
  leadership: string;
}

export function formatOfficerTerms(terms: OfficerTerm[]): OfficerTermForRecord[] {
  return terms.filter(isCompleteOfficerTerm).map((t) => ({
    term: formatOfficerTerm(t),
    leadership: (t.note ?? "").trim(),
  }));
}

/** 임기·직책·날짜가 모두 채워진 경우에만 기록으로 인정한다. (리더십 메모는 없어도 된다) */
export function isCompleteOfficerTerm(
  term: Partial<OfficerTerm> | null | undefined,
): term is OfficerTerm {
  if (!term) return false;
  return Boolean(term.period && term.role && term.startDate && term.endDate);
}

export const MAX_OFFICER_TERMS = 3;
