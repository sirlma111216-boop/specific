import { describe, expect, it } from "vitest";
import {
  formatOfficerTerm,
  formatOfficerTerms,
  isCompleteOfficerTerm,
  type OfficerTerm,
} from "@/lib/roster/officer";

const base: OfficerTerm = {
  period: "first",
  role: "president",
  startDate: "2026-03-01",
  endDate: "2026-08-18",
};

describe("임원 재임 표기", () => {
  it("학급 회장 — 기재요령 표기", () => {
    expect(formatOfficerTerm(base)).toBe("1학기 학급회장(2026.03.01.-2026.08.18.)");
  });

  it("학급 부회장", () => {
    expect(formatOfficerTerm({ ...base, role: "vicePresident" })).toBe(
      "1학기 학급부회장(2026.03.01.-2026.08.18.)",
    );
  });

  it("2학기", () => {
    expect(formatOfficerTerm({ ...base, period: "second" })).toBe(
      "2학기 학급회장(2026.03.01.-2026.08.18.)",
    );
  });

  // 전교 회장·부회장은 학생회 기록이라 담임이 아닌 담당 교사가 '활동 입력'으로 남긴다.
  it("임원은 언제나 학급 임원으로 표기한다", () => {
    expect(formatOfficerTerm({ ...base, role: "vicePresident" })).not.toContain("전교");
  });
});

describe("임원 입력 검증", () => {
  it("네 항목이 모두 있어야 인정한다", () => {
    expect(isCompleteOfficerTerm(base)).toBe(true);
    expect(isCompleteOfficerTerm({ ...base, endDate: "" })).toBe(false);
    expect(isCompleteOfficerTerm({ ...base, startDate: "" })).toBe(false);
    expect(isCompleteOfficerTerm(null)).toBe(false);
    expect(isCompleteOfficerTerm(undefined)).toBe(false);
  });

  it("리더십 메모는 없어도 인정한다", () => {
    expect(isCompleteOfficerTerm({ ...base, note: undefined })).toBe(true);
  });

  it("덜 채워진 항목은 목록에서 걸러진다", () => {
    const terms = [base, { ...base, period: "second" as const, endDate: "" }];
    expect(formatOfficerTerms(terms)).toEqual([
      { term: "1학기 학급회장(2026.03.01.-2026.08.18.)", leadership: "" },
    ]);
  });

  it("1학기·2학기를 함께 적을 수 있고, 리더십 메모가 함께 실린다", () => {
    const terms: OfficerTerm[] = [
      { ...base, note: "학급 회의를 끝까지 진행함" },
      {
        period: "second",
        role: "vicePresident",
        startDate: "2026-08-19",
        endDate: "2027-02-05",
      },
    ];
    expect(formatOfficerTerms(terms)).toEqual([
      {
        term: "1학기 학급회장(2026.03.01.-2026.08.18.)",
        leadership: "학급 회의를 끝까지 진행함",
      },
      { term: "2학기 학급부회장(2026.08.19.-2027.02.05.)", leadership: "" },
    ]);
  });
});

import { sanitizeRecordGenerationPayload } from "@/lib/gemini/sanitize";
import { validateRecordDraft } from "@/lib/record-validator/validate";

describe("임원 표기와 개인정보 제거", () => {
  const input = {
    category: "autonomous" as const,
    targetLength: 300,
    selectionMode: "priority" as const,
    events: [
      {
        title: "학급임원선거",
        description: "학급 임원을 뽑는 활동",
        eventDate: "2026.08.19.",
        studentReflection: "학급이 더 민주적이 되면 좋겠다",
        hasStudentReflection: true,
        teacherSelectionOrder: 1,
      },
    ],
    officerTerms: [
      { term: "1학기 학급회장(2026.03.01.-2026.08.18.)", leadership: "학급 회의를 끝까지 진행함" },
    ],
    identifiersToRedact: ["김민서", "한빛중학교"],
  };

  it("임원 표기가 payload에 그대로 실린다", () => {
    const payload = sanitizeRecordGenerationPayload(input);
    expect(payload.officerTerms).toEqual([
      { term: "1학기 학급회장(2026.03.01.-2026.08.18.)", leadership: "학급 회의를 끝까지 진행함" },
    ]);
  });

  it("임원 표기와 리더십 메모에도 실명 마스킹이 적용된다", () => {
    const payload = sanitizeRecordGenerationPayload({
      ...input,
      officerTerms: [
        { term: "1학기 학급회장 김민서(2026.03.01.-2026.08.18.)", leadership: "김민서가 회의를 이끎" },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("김민서");
  });

  it("임원이 아니면 빈 배열", () => {
    const payload = sanitizeRecordGenerationPayload({ ...input, officerTerms: [] });
    expect(payload.officerTerms).toEqual([]);
  });
});

const OFFICER = "1학기 학급회장(2026.03.01.-2026.08.18.)";
const EVENTS = [
  {
    title: "학급임원선거",
    eventDate: "2026.08.19.",
    hasStudentReflection: true,
    studentReflection: "학급이 더 민주적이 되면 좋겠다",
  },
];

describe("임원 표기 검증", () => {
  it("첫 문장이 임원으로 시작하면 통과", () => {
    const text = `${OFFICER}으로서 급우들의 의견을 고루 수렴하며 학급을 이끄는 지도력을 보임. 학급임원선거(2026.08.19.)를 통해 민주적 절차의 중요성을 인식함.`;
    const r = validateRecordDraft({
      text,
      targetLength: 100,
      events: EVENTS,
      officerTerms: [OFFICER],
    });
    expect(r.issues.map((i) => i.code)).not.toContain("officer_missing");
  });

  it("임원 표기가 아예 없으면 잡아낸다", () => {
    const text = "학급임원선거(2026.08.19.)를 통해 민주적 절차의 중요성을 인식함.";
    const r = validateRecordDraft({
      text,
      targetLength: 40,
      events: EVENTS,
      officerTerms: [OFFICER],
    });
    expect(r.issues.map((i) => i.code)).toContain("officer_missing");
  });

  it("임원 표기가 뒤에 묻혀 있으면 앞으로 옮기라고 한다", () => {
    const text = `학급임원선거(2026.08.19.)를 통해 민주적 절차의 중요성을 인식함. ${OFFICER}으로서 학급을 이끎.`;
    const r = validateRecordDraft({
      text,
      targetLength: 90,
      events: EVENTS,
      officerTerms: [OFFICER],
    });
    const issue = r.issues.find((i) => i.code === "officer_missing");
    expect(issue?.message).toContain("첫 문장");
  });

  it("임원이 아니면 이 검증을 하지 않는다", () => {
    const text = "학급임원선거(2026.08.19.)를 통해 민주적 절차의 중요성을 인식함.";
    const r = validateRecordDraft({ text, targetLength: 40, events: EVENTS });
    expect(r.issues.map((i) => i.code)).not.toContain("officer_missing");
  });
});

describe("임원 직위는 허구 성취로 보지 않는다", () => {
  it("교사가 입력한 임원이면 '회장'이 문제되지 않는다", () => {
    const text = `${OFFICER}으로서 급우들의 의견을 수렴하며 학급을 이끄는 지도력을 보임.`;
    const r = validateRecordDraft({
      text,
      targetLength: 45,
      events: EVENTS,
      officerTerms: [OFFICER],
    });
    expect(r.issues.map((i) => i.code)).not.toContain("fabricated_detail");
  });

  it("임원이 아닌데 회장이라고 쓰면 여전히 잡는다", () => {
    const text = "학급 회장으로서 급우들을 이끄는 지도력을 보임.";
    const r = validateRecordDraft({ text, targetLength: 27, events: EVENTS });
    expect(r.issues.map((i) => i.code)).toContain("fabricated_detail");
  });
});
