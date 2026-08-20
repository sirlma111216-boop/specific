import type { EventPhase, EventStatus } from "@/lib/types";

/**
 * 학생에게 보이는 활동 상태를 계산한다.
 *
 * - 이미 작성했으면 '작성 완료'. 날짜가 지나도 본인 기록은 계속 볼 수 있다.
 * - status가 'closed'면 마감. (교사가 직접 마감)
 * - status가 'open'이면 날짜와 무관하게 작성 가능. (교사의 '지금 공개' / '다시 열기')
 * - status가 'scheduled'면 활동 당일에만 작성할 수 있다.
 *   · 활동 날짜 이전  → 예정 (학생에게 미리 보이지 않음)
 *   · 활동 당일       → 작성 가능
 *   · 활동 날짜 이후  → 마감. 그날 쓰지 않았다면 이후에는 쓸 수 없고 조회만 가능하다.
 *     결석 등으로 예외가 필요하면 교사가 '다시 열기'로 되살린다.
 */
export function computeEventPhase(
  status: EventStatus,
  eventDate: string,
  today: string,
  hasResponse: boolean,
): EventPhase {
  if (hasResponse) return "submitted";
  if (status === "closed") return "closed";
  if (status === "open") return "writable";
  if (eventDate > today) return "scheduled";
  if (eventDate < today) return "closed";
  return "writable";
}

/** 교사가 열어준 것이 아니라 활동 날짜가 지나서 닫힌 경우인지 */
export function isPastDue(status: EventStatus, eventDate: string, today: string): boolean {
  return status === "scheduled" && eventDate < today;
}

/**
 * 지금 이 활동에 글을 쓸 수 있는가.
 *
 * 이미 작성했는지는 보지 않는다. 그래야 "그날 쓴 학생"도 날짜가 지나면
 * 수정할 수 없고 조회만 가능해진다. (computeEventPhase는 hasResponse가 있으면
 * 무조건 '작성 완료'를 돌려주므로 쓰기 판정에는 쓸 수 없다.)
 */
export function canWriteNow(status: EventStatus, eventDate: string, today: string): boolean {
  return computeEventPhase(status, eventDate, today, false) === "writable";
}

/** 학생 화면에서 기록이 비어 있을 때 보여줄 문구 */
export function emptyRecordText(phase: EventPhase): string {
  if (phase === "closed") return "작성 기간이 지나 기록이 없습니다.";
  if (phase === "writable") return "아직 작성하지 않았습니다.";
  return "작성한 기록이 없습니다.";
}

export const PHASE_LABEL: Record<EventPhase, string> = {
  scheduled: "예정",
  writable: "작성 가능",
  submitted: "작성 완료",
  closed: "마감",
};
