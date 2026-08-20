import { describe, expect, it } from "vitest";
import { formatRecordDate } from "@/lib/utils";
import { splitSentences, validateRecordDraft } from "@/lib/record-validator/validate";

describe("생기부 날짜 표기", () => {
  it("YYYY-MM-DD를 기재요령 표기로 바꾼다", () => {
    expect(formatRecordDate("2026-08-19")).toBe("2026.08.19.");
    expect(formatRecordDate("2026-03-04")).toBe("2026.03.04.");
  });

  it("빈 값이면 그대로 둔다", () => {
    expect(formatRecordDate("")).toBe("");
  });

  it("날짜 안의 마침표에서 문장이 잘리지 않는다", () => {
    const text = "학급임원선거(2026.08.19.)에 참여하여 민주적 절차를 이해함. 성찰하는 모습을 보임.";
    expect(splitSentences(text)).toHaveLength(2);
  });
});

const EVENTS = [
  {
    title: "학급임원선거",
    eventDate: "2026.08.19.",
    hasStudentReflection: true,
    studentReflection: "학급이 더 민주적이 되면 좋겠다",
  },
  {
    title: "학교폭력예방교육",
    eventDate: "2026.08.21.",
    hasStudentReflection: true,
    studentReflection: "가해자들도 피해자의 입장에서 생각해봤으면 좋겠다",
  },
];

describe("날짜 표기 검증", () => {
  it("활동명 뒤에 날짜가 있으면 통과", () => {
    const text =
      "학급임원선거(2026.08.19.)에 참여하여 민주적인 학급 운영의 중요성을 인식함. 학교폭력예방교육(2026.08.21.)을 통해 역지사지의 태도가 필요함을 이해한 것으로 보임.";
    const r = validateRecordDraft({ text, targetLength: 90, events: EVENTS });
    expect(r.issues.map((i) => i.code)).not.toContain("missing_date");
  });

  it("날짜가 빠지면 잡아낸다", () => {
    const text =
      "학급임원선거에 참여하여 민주적인 학급 운영의 중요성을 인식함. 학교폭력예방교육(2026.08.21.)을 통해 역지사지의 태도가 필요함을 이해한 것으로 보임.";
    const r = validateRecordDraft({ text, targetLength: 78, events: EVENTS });
    const issue = r.issues.find((i) => i.code === "missing_date");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("학급임원선거");
    expect(issue?.message).not.toContain("학교폭력예방교육");
  });

  it("본문에 아예 없는 활동은 날짜 문제로 잡지 않는다", () => {
    // 분량 때문에 빠진 활동까지 날짜 누락으로 몰면 불필요한 재생성이 돈다
    const text = "학급임원선거(2026.08.19.)에 참여하여 민주적인 학급 운영의 중요성을 인식함.";
    const r = validateRecordDraft({ text, targetLength: 40, events: EVENTS });
    expect(r.issues.map((i) => i.code)).not.toContain("missing_date");
  });
});
