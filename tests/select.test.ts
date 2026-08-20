import { describe, expect, it } from "vitest";
import {
  computeCapacity,
  selectEventsForGeneration,
  sortByPriority,
  type SelectableEvent,
} from "@/lib/record-generator/select";

function ev(
  id: string,
  hasStudentReflection: boolean,
  teacherSelectionOrder: number,
): SelectableEvent {
  return {
    eventId: id,
    title: `활동 ${id}`,
    description: "",
    eventDate: "2026-03-01",
    studentReflection: hasStudentReflection ? `${id} 소감` : "",
    hasStudentReflection,
    teacherSelectionOrder,
  };
}

describe("활동 선택", () => {
  it("목표 글자 수로 활동 수를 정한다", () => {
    expect(computeCapacity(500, 10)).toBe(5);
    expect(computeCapacity(300, 10)).toBe(3);
    expect(computeCapacity(100, 10)).toBe(1);
    // 선택한 활동 수를 넘지 않는다
    expect(computeCapacity(1000, 3)).toBe(3);
    // 목표가 아주 짧아도 최소 1개는 쓴다
    expect(computeCapacity(20, 5)).toBe(1);
  });

  // 요구사항 테스트 9
  it("학생 기록 여부가 교사 체크 순서보다 한 단계 높은 우선순위다", () => {
    const events = [ev("A", true, 1), ev("B", false, 2), ev("C", true, 3)];
    expect(sortByPriority(events).map((e) => e.eventId)).toEqual(["A", "C", "B"]);
  });

  // 요구사항 테스트 8
  it("목표가 짧으면 학생 기록 없는 활동부터 제외된다", () => {
    const events = [
      ev("A", true, 1),
      ev("B", false, 2),
      ev("C", true, 3),
      ev("D", false, 4),
      ev("E", true, 5),
    ];
    const used = selectEventsForGeneration(events, { mode: "priority", targetLength: 300 });
    expect(used.map((e) => e.eventId).sort()).toEqual(["A", "C", "E"]);
  });

  it("여유가 있으면 기록 없는 활동도 보충한다", () => {
    const events = [
      ev("A", true, 1),
      ev("B", false, 2),
      ev("C", true, 3),
      ev("D", false, 4),
      ev("E", true, 5),
    ];
    const used = selectEventsForGeneration(events, { mode: "priority", targetLength: 500 });
    expect(used).toHaveLength(5);
    // 앞 3개는 학생 기록이 있는 활동
    expect(used.slice(0, 3).every((e) => e.hasStudentReflection)).toBe(true);
  });

  // 요구사항 테스트 10
  it("무작위 방식도 학생 기록 있는 활동을 먼저 뽑는다", () => {
    const events = [
      ...[1, 2, 3, 4, 5].map((n) => ev(`R${n}`, true, n)),
      ...[6, 7, 8].map((n) => ev(`N${n}`, false, n)),
    ];
    for (let i = 0; i < 50; i += 1) {
      const used = selectEventsForGeneration(events, { mode: "random", targetLength: 300 });
      expect(used).toHaveLength(3);
      expect(used.every((e) => e.hasStudentReflection)).toBe(true);
    }
  });

  it("무작위 방식에서 기록 있는 활동이 모자라면 기록 없는 활동으로 채운다", () => {
    const events = [ev("R1", true, 1), ev("N1", false, 2), ev("N2", false, 3), ev("N3", false, 4)];
    const used = selectEventsForGeneration(events, { mode: "random", targetLength: 300 });
    expect(used).toHaveLength(3);
    expect(used.filter((e) => e.hasStudentReflection)).toHaveLength(1);
  });

  it("무작위 방식은 다시 생성하면 다른 조합이 나올 수 있다", () => {
    const events = [1, 2, 3, 4, 5, 6].map((n) => ev(`R${n}`, true, n));
    const combos = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const used = selectEventsForGeneration(events, { mode: "random", targetLength: 300 });
      combos.add(used.map((e) => e.eventId).sort().join(","));
    }
    expect(combos.size).toBeGreaterThan(1);
  });

  it("체크 순서 우선 방식은 항상 같은 결과를 준다", () => {
    const events = [ev("A", true, 1), ev("B", true, 2), ev("C", false, 3)];
    const first = selectEventsForGeneration(events, { mode: "priority", targetLength: 200 });
    const second = selectEventsForGeneration(events, { mode: "priority", targetLength: 200 });
    expect(first.map((e) => e.eventId)).toEqual(second.map((e) => e.eventId));
  });

  it("선택한 활동이 없으면 빈 배열", () => {
    expect(selectEventsForGeneration([], { mode: "priority", targetLength: 500 })).toEqual([]);
  });
});
