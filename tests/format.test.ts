import { describe, expect, it } from "vitest";
import {
  formatClassFull,
  formatClassName,
  formatGrade,
  formatClassNumber,
  formatSchoolYear,
  singleParagraph,
} from "@/lib/utils";

describe("특기사항 본문 한 덩어리로 만들기", () => {
  it("빈 줄과 줄바꿈을 공백 한 칸으로 합친다", () => {
    expect(singleParagraph("가에 참여함.\n\n나에 참여함.")).toBe("가에 참여함. 나에 참여함.");
    expect(singleParagraph("가에 참여함.\n나에 참여함.")).toBe("가에 참여함. 나에 참여함.");
  });

  it("이어진 공백도 한 칸으로 줄인다", () => {
    expect(singleParagraph("가에 참여함.    나에 참여함.")).toBe("가에 참여함. 나에 참여함.");
  });

  it("앞뒤 공백을 정리한다", () => {
    expect(singleParagraph("  가에 참여함.  \n")).toBe("가에 참여함.");
  });

  it("이미 한 줄이면 그대로 둔다", () => {
    const text = "학교폭력예방교육(2026.03.04.)에 참여하는 모습을 보임.";
    expect(singleParagraph(text)).toBe(text);
  });
});

describe("학급 표기", () => {
  it("숫자만 입력했으면 단위를 붙인다", () => {
    expect(formatGrade("3")).toBe("3학년");
    expect(formatClassNumber("1")).toBe("1반");
  });

  it("이미 단위가 있으면 두 번 붙이지 않는다", () => {
    expect(formatGrade("3학년")).toBe("3학년");
    expect(formatClassNumber("1반")).toBe("1반");
  });

  it("숫자가 아닌 반 이름은 그대로 둔다", () => {
    expect(formatClassNumber("가온반")).toBe("가온반");
  });

  it("학급 이름을 합친다", () => {
    expect(formatClassName("3", "1")).toBe("3학년 1반");
    expect(formatClassName("3학년", "1반")).toBe("3학년 1반");
  });

  it("학년도를 붙인다", () => {
    expect(formatSchoolYear(2026)).toBe("2026학년도");
  });

  it("전체 표기", () => {
    expect(formatClassFull(2026, "3", "1")).toBe("2026학년도 3학년 1반");
  });

  it("빈 값은 자리를 차지하지 않는다", () => {
    expect(formatClassName("3", "")).toBe("3학년");
    expect(formatSchoolYear("")).toBe("");
  });
});
