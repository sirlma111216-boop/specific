import { describe, expect, it } from "vitest";
import {
  assertNoPersonalInfo,
  redactKnownIdentifiers,
  sanitizeRecordGenerationPayload,
} from "@/lib/gemini/sanitize";

const BASE = {
  category: "autonomous" as const,
  targetLength: 500,
  selectionMode: "priority" as const,
  events: [
    {
      title: "학교폭력 예방교육",
      description: "학교폭력의 유형과 대처 방법을 배우는 교육",
      eventDate: "2026-03-12",
      studentReflection: "나는 김민서인데, 장난이 폭력이 될 수 있다는 걸 알게 되었다.",
      hasStudentReflection: true,
      teacherSelectionOrder: 1,
    },
  ],
  identifiersToRedact: ["김민서", "한빛중학교", "홍길동", "student@school.kr"],
};

describe("개인정보 제거", () => {
  // 요구사항 테스트 11
  it("payload에 이름·학교·교사명·이메일이 남지 않는다", () => {
    const payload = sanitizeRecordGenerationPayload(BASE);
    const json = JSON.stringify(payload);
    expect(json).not.toContain("김민서");
    expect(json).not.toContain("한빛중학교");
    expect(json).not.toContain("홍길동");
    expect(json).not.toContain("student@school.kr");
  });

  it("허용된 필드만 남긴다", () => {
    const payload = sanitizeRecordGenerationPayload(BASE);
    expect(Object.keys(payload).sort()).toEqual([
      "category",
      "events",
      "selectionMode",
      "targetLength",
    ]);
    expect(Object.keys(payload.events[0]).sort()).toEqual([
      "description",
      "eventDate",
      "hasStudentReflection",
      "studentReflection",
      "teacherSelectionOrder",
      "title",
    ]);
  });

  it("학생 소감 안에 섞인 실명도 가린다", () => {
    const payload = sanitizeRecordGenerationPayload(BASE);
    expect(payload.events[0].studentReflection).toContain("○○");
    expect(payload.events[0].studentReflection).toContain("장난이 폭력이 될 수 있다");
  });

  it("활동 내용 자체는 그대로 전달된다", () => {
    const payload = sanitizeRecordGenerationPayload(BASE);
    expect(payload.events[0].title).toBe("학교폭력 예방교육");
    expect(payload.events[0].hasStudentReflection).toBe(true);
    expect(payload.events[0].teacherSelectionOrder).toBe(1);
    expect(payload.targetLength).toBe(500);
  });

  it("한 글자 식별자는 오탐이 커서 가리지 않는다", () => {
    expect(redactKnownIdentifiers("가나다", ["가"])).toBe("가나다");
  });

  it("정규식 특수문자가 든 이름도 안전하게 가린다", () => {
    expect(redactKnownIdentifiers("A.B 학생", ["A.B"])).toBe("○○ 학생");
    // 정규식으로 해석되면 "AXB"도 지워졌을 것이다
    expect(redactKnownIdentifiers("AXB 학생", ["A.B"])).toBe("AXB 학생");
  });

  it("금지된 키가 남아 있으면 호출을 막는다", () => {
    expect(() => assertNoPersonalInfo({ studentName: "김민서" }, [])).toThrow();
    expect(() => assertNoPersonalInfo({ schoolName: "○○중" }, [])).toThrow();
  });

  it("이메일 형식 문자열이 있으면 호출을 막는다", () => {
    expect(() => assertNoPersonalInfo({ note: "abc@def.kr" }, [])).toThrow();
  });

  it("깨끗한 payload는 통과한다", () => {
    expect(() => assertNoPersonalInfo({ title: "생명존중교육" }, ["김민서"])).not.toThrow();
  });
});
