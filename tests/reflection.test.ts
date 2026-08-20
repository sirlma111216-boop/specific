import { describe, expect, it } from "vitest";
import { mergeReflection } from "@/lib/events/reflection";

describe("학생 원문 + 교사 보완본 병합", () => {
  it("학생만 썼으면 학생 기록", () => {
    const r = mergeReflection("학생이 쓴 내용", "");
    expect(r.source).toBe("student");
    expect(r.reflection).toBe("학생이 쓴 내용");
    expect(r.studentOriginal).toBe("학생이 쓴 내용");
    expect(r.hasReflection).toBe(true);
  });

  it("교사가 고치면 수정본이 최종 기록이 되고 원문은 남는다", () => {
    const r = mergeReflection("학생 원문", "교사 수정본");
    expect(r.source).toBe("teacher-edited");
    expect(r.reflection).toBe("교사 수정본");
    expect(r.studentOriginal).toBe("학생 원문");
  });

  it("학생 기록 없이 교사만 적으면 교사 입력", () => {
    const r = mergeReflection("", "교사가 관찰한 내용");
    expect(r.source).toBe("teacher");
    expect(r.reflection).toBe("교사가 관찰한 내용");
    expect(r.studentOriginal).toBe("");
    expect(r.hasReflection).toBe(true);
  });

  it("둘 다 없으면 기록 없음", () => {
    const r = mergeReflection("", "");
    expect(r.source).toBe("none");
    expect(r.hasReflection).toBe(false);
    expect(r.reflection).toBe("");
  });

  it("교사 보완본을 비우면 학생 원문으로 돌아온다", () => {
    const r = mergeReflection("학생 원문", "   ");
    expect(r.source).toBe("student");
    expect(r.reflection).toBe("학생 원문");
  });

  it("공백만 있는 학생 기록은 기록으로 보지 않는다", () => {
    const r = mergeReflection("  \n ", "");
    expect(r.source).toBe("none");
    expect(r.hasReflection).toBe(false);
  });

  it("앞뒤 공백은 정리한다", () => {
    expect(mergeReflection("  내용  ", "").reflection).toBe("내용");
    expect(mergeReflection("", "  교사 내용 ").reflection).toBe("교사 내용");
  });
});
