import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();

// 실제 Gemini 호출 없이 파이프라인(선택 → 개인정보 제거 → 생성 → 검증 → 1회 수정)만 검증한다.
vi.mock("@/lib/gemini/client", () => ({
  generateText: (...args: unknown[]) => generateText(...args),
  GeminiError: class GeminiError extends Error {},
}));

const { generateStudentRecord, cleanDraft, MAX_REPAIR_ATTEMPTS } = await import(
  "@/lib/record-generator/generate"
);

const EVENTS = [
  {
    eventId: "a",
    title: "학교폭력 예방교육",
    description: "학교폭력의 유형과 대처 방법",
    eventDate: "2026-03-12",
    studentReflection: "장난이 폭력이 될 수 있다는 점이 기억에 남았다.",
    hasStudentReflection: true,
    teacherSelectionOrder: 1,
  },
  {
    eventId: "b",
    title: "심폐소생술 교육",
    description: "응급 상황 대처 교육",
    eventDate: "2026-04-03",
    studentReflection: "",
    hasStudentReflection: false,
    teacherSelectionOrder: 2,
  },
];

// 활동명 뒤 날짜 표기는 기재요령 관례이자 검증 항목이므로 픽스처에도 넣는다.
const GOOD_DRAFT: string =
  "학교폭력 예방교육(2026.03.12.)에 참여하여 사소한 장난도 상대에게는 폭력이 될 수 있음을 인식하는 모습을 보임. 심폐소생술 교육(2026.04.03.)을 통해 응급 상황에서의 대처와 생명 존중의 중요성을 이해한 것으로 보임.";

const GOOD_LENGTH = Array.from(GOOD_DRAFT).length;

describe("초안 정리", () => {
  it("모델이 붙인 머리말·따옴표·코드펜스를 떼어낸다", () => {
    expect(cleanDraft('특기사항: "참여함."')).toBe("참여함.");
    expect(cleanDraft("```\n참여함.\n```")).toBe("참여함.");
    expect(cleanDraft("- 참여함.")).toBe("참여함.");
  });
});

describe("특기사항 생성 파이프라인", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("개인정보를 제거한 payload만 AI로 보낸다", async () => {
    generateText.mockResolvedValue(GOOD_DRAFT);
    const result = await generateStudentRecord({
      category: "autonomous",
      targetLength: GOOD_LENGTH,
      selectionMode: "priority",
      events: EVENTS,
      identifiersToRedact: ["김민서", "한빛중학교", "홍길동"],
    });

    const sent = JSON.stringify(result.sanitizedPayload);
    expect(sent).not.toContain("김민서");
    expect(sent).not.toContain("한빛중학교");
    expect(sent).not.toContain("홍길동");
    expect(sent).not.toContain("eventId");
    expect(result.text).toBe(GOOD_DRAFT);
  });

  it("검증을 통과하면 재생성하지 않는다", async () => {
    generateText.mockResolvedValue(GOOD_DRAFT);
    const result = await generateStudentRecord({
      category: "autonomous",
      targetLength: GOOD_LENGTH,
      selectionMode: "priority",
      events: EVENTS,
      identifiersToRedact: [],
    });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.repairAttempts).toBe(0);
    expect(result.remainingIssues).toEqual([]);
  });

  // 요구사항 테스트 14 (글자 수 재검증 → 수정 생성)
  it("검증에 걸리면 한 번 더 수정 생성한다", async () => {
    generateText
      .mockResolvedValueOnce("나는 학교폭력 예방교육에서 많은 것을 느꼈다.")
      .mockResolvedValueOnce(GOOD_DRAFT);

    const result = await generateStudentRecord({
      category: "autonomous",
      targetLength: GOOD_LENGTH,
      selectionMode: "priority",
      events: EVENTS,
      identifiersToRedact: [],
    });

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.repairAttempts).toBe(1);
    expect(result.text).toBe(GOOD_DRAFT);
    expect(result.remainingIssues).toEqual([]);
  });

  it("무한 재시도하지 않는다", async () => {
    generateText.mockResolvedValue("나는 정말 재미있었다.");
    const result = await generateStudentRecord({
      category: "autonomous",
      targetLength: 500,
      selectionMode: "priority",
      events: EVENTS,
      identifiersToRedact: [],
    });
    expect(generateText).toHaveBeenCalledTimes(1 + MAX_REPAIR_ATTEMPTS);
    // 끝까지 문제가 남으면 교사에게 안내한다
    expect(result.remainingIssues.length).toBeGreaterThan(0);
  });

  it("수정본이 더 나빠지면 원래 초안을 유지한다", async () => {
    const slightlyLong = `${GOOD_DRAFT} 안전 의식이 향상된 것으로 평가됨.`;
    generateText
      .mockResolvedValueOnce(slightlyLong)
      .mockResolvedValueOnce("나는 이 교육이 좋았다고 생각했다.");

    const result = await generateStudentRecord({
      category: "autonomous",
      targetLength: GOOD_LENGTH,
      selectionMode: "priority",
      events: EVENTS,
      identifiersToRedact: [],
    });
    expect(result.text).toBe(slightlyLong);
  });

  it("목표가 짧으면 학생 기록 없는 활동은 AI에 보내지 않는다", async () => {
    generateText.mockResolvedValue(GOOD_DRAFT);
    const result = await generateStudentRecord({
      category: "autonomous",
      targetLength: 100,
      selectionMode: "priority",
      events: EVENTS,
      identifiersToRedact: [],
    });
    expect(result.usedEventIds).toEqual(["a"]);
    expect(result.sanitizedPayload.events).toHaveLength(1);
    expect(result.sanitizedPayload.events[0].title).toBe("학교폭력 예방교육");
  });
});
