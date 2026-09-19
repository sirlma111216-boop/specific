import { formatRecordDate } from "@/lib/utils";

/**
 * 개인 활동 기록(도서관 행사·학생부 활동 등)의 공통 규칙.
 * 입력 화면·저장 API·특기사항 생성이 모두 이 파일의 값을 쓴다.
 */

export const MAX_ACTIVITY_TITLE_LENGTH = 60;
/** 특기사항 문장이 아니라 사실 기록이므로 길게 받지 않는다. */
export const MAX_ACTIVITY_CONTENT_LENGTH = 300;
/** 한 번에 기록을 남길 수 있는 학생 수. 학년 전체를 한 번에 고르는 실수를 막는다. */
export const MAX_ACTIVITY_TARGETS = 300;

/** 하루면 "2026.03.05.", 기간이면 "2026.03.05.-2026.03.07." */
export function formatActivityPeriod(startDate: string, endDate: string): string {
  const start = formatRecordDate(startDate);
  if (!endDate || endDate === startDate) return start;
  return `${start}-${formatRecordDate(endDate)}`;
}

/** 일자 빠른 순. 같은 날이면 먼저 입력한 것이 앞으로. */
export function sortPersonalActivities<T extends { startDate: string; createdAt: number }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt - b.createdAt);
}

/** 화면과 API가 주고받는 개인 활동 한 건 */
export interface PersonalActivityItem {
  activityId: string;
  rosterId: string;
  title: string;
  content: string;
  startDate: string;
  endDate: string;
  /** "2026.03.05." 또는 "2026.03.05.-2026.03.07." */
  period: string;
  createdAt: number;
  updatedAt: number;
  /** 이 기록을 입력한 계정이 지금 보고 있는 사람인지 (고치기·지우기 가능 여부) */
  mine?: boolean;
}
