import type { SelectionMode } from "@/lib/types";

export interface SelectableEvent {
  eventId: string;
  title: string;
  description: string;
  eventDate: string;
  studentReflection: string;
  hasStudentReflection: boolean;
  /** 교사가 체크한 순서(1부터). 체크 해제 시 1..n으로 다시 정리된다. */
  teacherSelectionOrder: number;
}

/**
 * 활동 1건당 대략 이 정도 분량을 쓴다고 보고 목표 글자 수로 활동 수를 정한다.
 * 예) 500자 → 5개, 300자 → 3개.
 */
export const CHARS_PER_EVENT = 100;

export function computeCapacity(targetLength: number, totalEvents: number): number {
  if (totalEvents <= 0) return 0;
  const raw = Math.round(targetLength / CHARS_PER_EVENT);
  return Math.min(totalEvents, Math.max(1, raw));
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 학생 기록 있음 → 교사 체크 순서. 이 두 단계 정렬이 전체 우선순위다. */
export function sortByPriority(events: SelectableEvent[]): SelectableEvent[] {
  return [...events].sort((a, b) => {
    if (a.hasStudentReflection !== b.hasStudentReflection) {
      return a.hasStudentReflection ? -1 : 1;
    }
    return a.teacherSelectionOrder - b.teacherSelectionOrder;
  });
}

export interface SelectOptions {
  mode: SelectionMode;
  targetLength: number;
  rng?: () => number;
}

/**
 * 교사가 체크한 활동 중 이번 생성에 실제로 쓸 활동을 고른다.
 *
 * 두 방식 모두 공통 규칙: 학생이 직접 작성한 활동이 기록 없는 활동보다 항상 우선한다.
 * 목표 글자 수가 모자라면 기록 없는 활동부터 빠진다.
 */
export function selectEventsForGeneration(
  events: SelectableEvent[],
  { mode, targetLength, rng = Math.random }: SelectOptions,
): SelectableEvent[] {
  if (events.length === 0) return [];
  const capacity = computeCapacity(targetLength, events.length);

  if (mode === "priority") {
    return sortByPriority(events).slice(0, capacity);
  }

  // 무작위: 기록 있는 활동 안에서 먼저 뽑고, 모자랄 때만 기록 없는 활동을 채운다.
  const withReflection = events.filter((e) => e.hasStudentReflection);
  const withoutReflection = events.filter((e) => !e.hasStudentReflection);

  const picked = shuffle(withReflection, rng).slice(0, capacity);
  if (picked.length < capacity) {
    picked.push(...shuffle(withoutReflection, rng).slice(0, capacity - picked.length));
  }
  return picked;
}
