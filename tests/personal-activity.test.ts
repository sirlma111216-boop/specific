import { describe, expect, it } from "vitest";
import {
  formatActivityPeriod,
  sortPersonalActivities,
} from "@/lib/activities/personal";
import { computeCapacity } from "@/lib/record-generator/select";
import { sanitizeRecordGenerationPayload } from "@/lib/gemini/sanitize";
import { validateRecordDraft } from "@/lib/record-validator/validate";

describe("개인 활동 일자 표기", () => {
  it("하루짜리는 날짜 하나로 적는다", () => {
    expect(formatActivityPeriod("2026-03-05", "2026-03-05")).toBe("2026.03.05.");
  });

  it("기간이면 시작과 끝을 잇는다", () => {
    expect(formatActivityPeriod("2026-03-05", "2026-03-07")).toBe("2026.03.05.-2026.03.07.");
  });

  it("종료일이 비어 있으면 하루로 본다", () => {
    expect(formatActivityPeriod("2026-03-05", "")).toBe("2026.03.05.");
  });

  it("일자 빠른 순으로 정렬한다", () => {
    const list = [
      { startDate: "2026-05-02", createdAt: 2 },
      { startDate: "2026-03-05", createdAt: 3 },
      { startDate: "2026-03-05", createdAt: 1 },
    ];
    expect(sortPersonalActivities(list).map((a) => a.createdAt)).toEqual([1, 3, 2]);
  });
});

describe("분량 배분", () => {
  it("임원·개인 활동이 차지한 만큼 활동을 덜 고른다", () => {
    // 500자 → 5항목. 임원 1 + 개인 활동 2를 빼면 활동은 2개만 고른다.
    expect(computeCapacity(500, 10)).toBe(5);
    expect(computeCapacity(500, 10, 3)).toBe(2);
  });

  it("남는 자리가 없어도 활동 하나는 남긴다", () => {
    expect(computeCapacity(200, 10, 5)).toBe(1);
  });
});

const PERSONAL = [
  {
    title: "도서관 독서골든벨",
    activityDate: "2026.05.02.",
    content: "도서부원으로 예선 진행을 도움",
  },
];
const EVENTS = [
  {
    title: "학급임원선거",
    eventDate: "2026.08.19.",
    hasStudentReflection: true,
    studentReflection: "학급이 더 민주적이 되면 좋겠다",
  },
];

describe("개인 활동 검증", () => {
  it("담임이 체크한 개인 활동이 빠지면 잡아낸다", () => {
    const r = validateRecordDraft({
      text: "학급임원선거(2026.08.19.)를 통해 민주적 절차의 중요성을 인식하는 모습을 보임.",
      targetLength: 45,
      events: EVENTS,
      personalActivities: PERSONAL,
    });
    expect(r.issues.map((i) => i.code)).toContain("personal_missing");
  });

  it("들어가 있으면 문제 삼지 않는다", () => {
    const text =
      "도서관 독서골든벨(2026.05.02.)에서 예선 진행을 도우며 맡은 일을 성실히 해내는 모습을 보임. 학급임원선거(2026.08.19.)를 통해 민주적 절차의 중요성을 인식하는 모습이 관찰됨.";
    const r = validateRecordDraft({
      text,
      targetLength: countOf(text),
      events: EVENTS,
      personalActivities: PERSONAL,
    });
    expect(r.issues.map((i) => i.code)).not.toContain("personal_missing");
  });

  it("개인 활동에도 날짜 표기를 요구한다", () => {
    const text =
      "도서관 독서골든벨에서 예선 진행을 도우며 맡은 일을 성실히 해내는 모습을 보임. 학급임원선거(2026.08.19.)를 통해 민주적 절차의 중요성을 인식하는 모습이 관찰됨.";
    const r = validateRecordDraft({
      text,
      targetLength: countOf(text),
      events: EVENTS,
      personalActivities: PERSONAL,
    });
    expect(r.issues.map((i) => i.code)).toContain("missing_date");
  });

  it("담당 교사가 기록한 사실은 허구 성취로 보지 않는다", () => {
    const text =
      "학생회 캠페인(2026.04.10.)에서 대표로 홍보를 맡아 꾸준히 참여하는 모습을 보임.";
    const r = validateRecordDraft({
      text,
      targetLength: countOf(text),
      events: EVENTS,
      personalActivities: [
        {
          title: "학생회 캠페인",
          activityDate: "2026.04.10.",
          content: "학급 대표로 캠페인 홍보를 맡음",
        },
      ],
    });
    expect(r.issues.map((i) => i.code)).not.toContain("fabricated_detail");
  });
});

describe("개인 활동과 개인정보 제거", () => {
  it("활동명·내용에도 실명 마스킹이 적용된다", () => {
    const payload = sanitizeRecordGenerationPayload({
      category: "autonomous",
      targetLength: 300,
      selectionMode: "priority",
      events: [],
      personalActivities: [
        {
          title: "도서관 행사",
          activityDate: "2026.05.02.",
          content: "김민서 학생이 한빛중학교 도서관에서 진행을 도움",
        },
      ],
      identifiersToRedact: ["김민서", "한빛중학교"],
    });
    const json = JSON.stringify(payload);
    expect(json).not.toContain("김민서");
    expect(json).not.toContain("한빛중학교");
    expect(payload.personalActivities[0].activityDate).toBe("2026.05.02.");
  });
});

/** 글자 수 검증에 걸리지 않게 본문 길이를 그대로 목표로 쓴다. */
function countOf(text: string): number {
  return text.length;
}
