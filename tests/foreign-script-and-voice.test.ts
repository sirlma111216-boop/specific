import { describe, expect, it } from "vitest";
import { cleanDraft } from "@/lib/record-generator/generate";
import {
  hasObserverEnding,
  requiredObserverSentences,
  validateRecordDraft,
} from "@/lib/record-validator/validate";

/** 검증에 쓸 기본 활동 자료. 개별 테스트에서 필요한 것만 덮어쓴다. */
const EVENTS = [
  {
    title: "학교폭력 예방교육",
    hasStudentReflection: true,
    studentReflection: "장난도 폭력이 될 수 있다는 걸 알았다.",
    eventDate: "2026.03.12.",
  },
];

function validate(text: string, targetLength = 100) {
  return validateRecordDraft({ text, targetLength, tolerance: 10, events: EVENTS });
}

function codes(text: string): string[] {
  return validate(text).issues.map((i) => i.code);
}

describe("한자 탐지 범위", () => {
  // 한자 범위를 리터럴로 적었다가 저장 과정에서 U+F900이 U+8C48로 정규화되어
  // 범위가 한글(U+AC00~D7A3)까지 삼킨 적이 있다. 그 실패를 여기서 못박는다.
  it("순한글 본문을 한자로 잘못 잡지 않는다", () => {
    const text =
      "학교폭력 예방교육(2026.03.12.)에 참여하여 배려하는 태도를 보임. 자율·진로 활동에 성실히 참여하는 모습이 관찰됨.";
    expect(codes(text)).not.toContain("foreign_script");
  });

  it("한자가 섞이면 잡아낸다", () => {
    const text =
      "현재 상황을 検査하여 태도를 보임. 꾸준히 참여하는 모습이 관찰됨.";
    expect(codes(text)).toContain("foreign_script");
  });

  it("일본어 가나를 잡아낸다", () => {
    expect(codes("こ을 통해 성장하는 모습을 보임. 꾸준히 노력하는 태도가 관찰됨.")).toContain(
      "foreign_script",
    );
  });

  it("전각 괄호를 잡아낸다", () => {
    expect(codes("안전교육（2026）에 참여하는 모습을 보임. 꾸준히 실천하는 태도가 관찰됨.")).toContain(
      "foreign_script",
    );
  });
});

describe("cleanDraft 비한글 정리", () => {
  it("한자만 든 괄호를 통째로 뺀다", () => {
    const raw = "진로적성검사(適性檢査)(2026.03.20.) 결과를 해석하는 모습을 보임.";
    expect(cleanDraft(raw)).toBe("진로적성검사(2026.03.20.) 결과를 해석하는 모습을 보임.");
  });

  it("전각 기호를 반각으로 바꾼다", () => {
    const raw = "안전교육（2026.08.21.）에 참여함．";
    expect(cleanDraft(raw)).toBe("안전교육(2026.08.21.)에 참여함.");
  });

  it("날짜 괄호는 건드리지 않는다", () => {
    const raw = "학급임원선거(2026.08.19.)에 참여하는 모습을 보임.";
    expect(cleanDraft(raw)).toBe(raw);
  });

  it("시간 표기 괄호도 건드리지 않는다", () => {
    const raw = "양성평등교육(4시간)에 참여하는 모습을 보임.";
    expect(cleanDraft(raw)).toBe(raw);
  });

  it("기존 동작(따옴표·머리말 제거)을 유지한다", () => {
    expect(cleanDraft('특기사항: "참여하는 모습을 보임."')).toBe("참여하는 모습을 보임.");
  });
});

describe("지어낸 성취 탐지 오탐", () => {
  it("안전교육을 '전교'로 잘못 잡지 않는다", () => {
    const text =
      "안전교육(2026.08.21.)에 참여하여 안전 수칙을 익히는 모습을 보임. 위험 요소를 살피는 태도가 관찰됨.";
    expect(codes(text)).not.toContain("fabricated_detail");
  });

  it("전교 회장은 여전히 잡아낸다", () => {
    const text = "전교 회장으로서 학교 행사를 이끄는 모습을 보임. 책임감이 관찰됨.";
    expect(codes(text)).toContain("fabricated_detail");
  });
});

describe("교사 관찰자 시점 종결", () => {
  it("관찰 종결을 알아본다", () => {
    expect(hasObserverEnding("태도를 보임.")).toBe(true);
    expect(hasObserverEnding("것으로 평가됨.")).toBe(true);
    expect(hasObserverEnding("모습이 관찰됨.")).toBe(true);
    expect(hasObserverEnding("태도가 나타남.")).toBe(true);
  });

  it("학생 관점 종결은 관찰 종결로 보지 않는다", () => {
    expect(hasObserverEnding("중요성을 인식함.")).toBe(false);
    expect(hasObserverEnding("깊이 성찰함.")).toBe(false);
    expect(hasObserverEnding("안전 의식을 고취함.")).toBe(false);
    expect(hasObserverEnding("이해함.")).toBe(false);
  });

  it("문장 수의 절반(올림)을 요구한다", () => {
    expect(requiredObserverSentences(4)).toBe(2);
    expect(requiredObserverSentences(5)).toBe(3);
    expect(requiredObserverSentences(7)).toBe(4);
  });

  it("마지막 문장에만 관찰 종결이 있으면 잡아낸다", () => {
    // 사용자가 보고한 바로 그 형태
    const text =
      "중요성을 인식함. 깊이 성찰함. 안전 의식을 고취함. 배려하는 모습을 보임.";
    expect(codes(text)).toContain("observer_voice");
  });

  it("절반 이상이 관찰 종결이면 통과한다", () => {
    const text =
      "중요성을 인식하는 모습을 보임. 깊이 성찰한 것으로 평가됨. 안전 의식을 고취함.";
    expect(codes(text)).not.toContain("observer_voice");
  });

  it("한 문장짜리는 문제 삼지 않는다", () => {
    expect(codes("안전 의식을 고취함.")).not.toContain("observer_voice");
  });

  it("지적 문구에 고칠 문장을 담아 준다", () => {
    const text =
      "중요성을 인식함. 깊이 성찰함. 안전 의식을 고취함. 배려하는 모습을 보임.";
    const issue = validate(text).issues.find((i) => i.code === "observer_voice");
    expect(issue?.instruction).toContain("중요성을 인식함");
  });
});
