import type { EventPhase, EventStatus } from "@/lib/types";

/**
 * 이 활동을 언제까지 쓸 수 있는가. (YYYY-MM-DD 한국 날짜, 마감된 활동은 null)
 *
 *  · scheduled — 활동 당일 하루.
 *  · open      — 관리자가 정한 openUntil 까지. 값이 없던 예전 활동은 활동 당일까지로 본다.
 *  · closed    — 쓸 수 없다.
 *
 * '지금 공개'로 연 활동이 영영 열린 채로 남지 않게 하는 것이 openUntil 의 목적이다.
 * 지나간 활동을 '다시 열기'로 열면 서버가 openUntil 을 오늘로 잡아, 내일이면 저절로 닫힌다.
 */
export function writableUntil(
  status: EventStatus,
  eventDate: string,
  openUntil?: string,
): string | null {
  if (status === "closed") return null;
  if (status === "open") return openUntil?.trim() || eventDate;
  return eventDate;
}

/**
 * 활동을 '지금 공개 / 다시 열기'로 열 때, 언제까지 열어 둘지.
 * 앞으로 올 활동이면 활동 당일까지, 지나간 활동이면 오늘까지. (내일이 되면 저절로 마감된다)
 */
export function openUntilFor(eventDate: string, today: string): string {
  return eventDate > today ? eventDate : today;
}

/**
 * 학생에게 보이는 활동 상태를 계산한다.
 *
 * - 이미 작성했으면 '작성 완료'. 날짜가 지나도 본인 기록은 계속 볼 수 있다.
 * - status가 'closed'면 마감. (관리자가 직접 마감)
 * - 쓸 수 있는 기간(writableUntil)이 지나면 마감. 그날 쓰지 않았다면 이후에는 조회만 가능하다.
 *   결석 등으로 예외가 필요하면 관리자가 '다시 열기'로 되살린다.
 * - status가 'scheduled'인데 활동 날짜가 아직 오지 않았으면 예정. (학생에게 미리 보이지 않음)
 * - status가 'open'이면 활동 날짜 전에도 쓸 수 있다. ('지금 공개')
 */
export function computeEventPhase(
  status: EventStatus,
  eventDate: string,
  today: string,
  hasResponse: boolean,
  openUntil?: string,
): EventPhase {
  if (hasResponse) return "submitted";
  if (status === "closed") return "closed";

  const until = writableUntil(status, eventDate, openUntil);
  if (until !== null && today > until) return "closed";
  if (status === "scheduled" && eventDate > today) return "scheduled";
  return "writable";
}

/** 관리자가 직접 마감한 것이 아니라, 쓸 수 있는 기간이 지나서 닫힌 경우인지 */
export function isPastDue(
  status: EventStatus,
  eventDate: string,
  today: string,
  openUntil?: string,
): boolean {
  const until = writableUntil(status, eventDate, openUntil);
  return until !== null && today > until;
}

/**
 * 지금 이 활동에 글을 쓸 수 있는가.
 *
 * 이미 작성했는지는 보지 않는다. 마감 전이라면 학생이 자기 기록을 고칠 수 있어야 하고,
 * 마감된 뒤에는 그날 쓴 학생도 고칠 수 없어야 하기 때문이다.
 * (computeEventPhase는 hasResponse가 있으면 무조건 '작성 완료'를 돌려주므로 쓰기 판정에는 쓸 수 없다.)
 */
export function canWriteNow(
  status: EventStatus,
  eventDate: string,
  today: string,
  openUntil?: string,
): boolean {
  return computeEventPhase(status, eventDate, today, false, openUntil) === "writable";
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
