import { describe, expect, it } from "vitest";
import {
  endsWithNounForm,
  splitSentences,
  validateRecordDraft,
} from "@/lib/record-validator/validate";
import { countCharacters } from "@/lib/utils";

const EVENTS = [
  { title: "학교폭력 예방교육", hasStudentReflection: true, studentReflection: "장난도 폭력이 될 수 있다는 점이 기억에 남았다." },
  { title: "심폐소생술 교육", hasStudentReflection: false, studentReflection: "" },
];

/** 목표 길이에 맞춘 더미 문장을 만든다. */
function draftOfLength(target: number): string {
  const unit = "학교폭력 예방교육에 참여하여 타인을 존중하는 태도의 중요성을 인식함. ";
  let text = "";
  while (countCharacters(text) < target) text += unit;
  return text.slice(0, target - 1).replace(/[^가-힣]+$/, "") + "함.";
}

describe("종결어미 판정", () => {
  it("~함/~임/~음/~보임/~평가됨을 통과시킨다", () => {
    for (const s of ["참여함", "필요함", "성찰하는 모습을 보임", "향상된 것으로 평가됨", "노력이 있었음"]) {
      expect(endsWithNounForm(s)).toBe(true);
    }
  });

  it("~했습니다/~하였다/~이다는 걸러낸다", () => {
    for (const s of ["참여했습니다", "노력하였다", "중요하다고 생각했다", "좋은 태도이다"]) {
      expect(endsWithNounForm(s)).toBe(false);
    }
  });

  it("괄호로 끝나도 앞의 어미로 판단한다", () => {
    expect(endsWithNounForm("양성평등교육에 참여함(4시간)")).toBe(true);
  });

  it("날짜의 마침표에서 문장을 자르지 않는다", () => {
    const s = splitSentences("학교폭력예방교육(2026.03.04.-2026.07.08.)에 참여함. 성찰하는 모습을 보임.");
    expect(s).toHaveLength(2);
  });
});

describe("생성 결과 검증", () => {
  it("규격에 맞는 초안은 통과한다", () => {
    const text =
      "학교폭력 예방교육에 참여하여 사소한 장난도 상대에게는 폭력이 될 수 있음을 인식하는 모습을 보임. 심폐소생술 교육을 통해 응급 상황에서의 대처와 생명 존중의 중요성을 이해한 것으로 보임.";
    const result = validateRecordDraft({
      text,
      targetLength: countCharacters(text),
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  // 검증 1
  it("목표 글자 수를 벗어나면 잡아낸다", () => {
    const result = validateRecordDraft({
      text: draftOfLength(620),
      targetLength: 500,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("length");
  });

  it("±5% 안이면 길이 문제로 보지 않는다", () => {
    const text = draftOfLength(492);
    const result = validateRecordDraft({ text, targetLength: 500, events: EVENTS });
    expect(result.issues.map((i) => i.code)).not.toContain("length");
  });

  // 검증 2
  it("학생 1인칭 표현을 잡아낸다", () => {
    const result = validateRecordDraft({
      text: "나는 학교폭력 예방교육을 통해 많은 것을 느꼈다. 심폐소생술 교육에 참여함.",
      targetLength: 40,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("first_person");
  });

  // 검증 3
  it("생기부 종결어미가 아니면 잡아낸다", () => {
    const result = validateRecordDraft({
      text: "학교폭력 예방교육에 열심히 참여하였다. 심폐소생술 교육도 들었습니다.",
      targetLength: 36,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("sentence_ending");
  });

  // 검증 4
  it("부정 평가를 잡아낸다", () => {
    const result = validateRecordDraft({
      text: "학교폭력 예방교육에 대한 이해가 부족함. 심폐소생술 교육에 참여함.",
      targetLength: 34,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("negative_or_overpraise");
  });

  it("근거 없는 과대 평가를 잡아낸다", () => {
    const result = validateRecordDraft({
      text: "학교폭력 예방교육에서 또래보다 우수함. 심폐소생술 교육에 참여함.",
      targetLength: 33,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("negative_or_overpraise");
  });

  // 검증 5
  it("학생 기록 있는 활동이 빠지고 없는 활동만 들어가면 잡아낸다", () => {
    const result = validateRecordDraft({
      text: "심폐소생술 교육에 참여하여 응급 상황 대처의 중요성을 인식함.",
      targetLength: 31,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("reflection_underused");
  });

  // 검증 6
  it("원본에 없는 구체적 성취를 잡아낸다", () => {
    const result = validateRecordDraft({
      text: "학교폭력 예방교육에 참여함. 심폐소생술 실습에서 또래의 모범이 됨.",
      targetLength: 34,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("fabricated_detail");
  });

  it("기재 금지 고유명사(대학명 등)를 잡아낸다", () => {
    const result = validateRecordDraft({
      text: "학교폭력 예방교육에 참여함. ○○대학교 강사의 심폐소생술 교육을 들음.",
      targetLength: 36,
      events: EVENTS,
    });
    expect(result.issues.map((i) => i.code)).toContain("fabricated_detail");
  });

  it("학생이 실제로 쓴 표현이면 허구로 보지 않는다", () => {
    const events = [
      { title: "학급 자치회", hasStudentReflection: true, studentReflection: "반장으로서 학급 회의를 진행했다." },
    ];
    const result = validateRecordDraft({
      text: "학급 자치회에서 반장으로서 회의를 이끄는 모습을 보임.",
      targetLength: 28,
      events,
    });
    expect(result.issues.map((i) => i.code)).not.toContain("fabricated_detail");
  });
});

describe("글자 수", () => {
  it("공백을 포함해 센다", () => {
    expect(countCharacters("가 나")).toBe(3);
  });

  it("한글은 한 글자로 센다", () => {
    expect(countCharacters("학교생활기록부")).toBe(7);
  });
});
