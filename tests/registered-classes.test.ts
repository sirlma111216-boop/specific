import { describe, expect, it } from "vitest";
import {
  classNumbersOf,
  gradesOf,
  groupRegisteredClasses,
} from "@/lib/roster/registered-classes";

describe("등록된 학급 목록 묶기", () => {
  it("학교별로 묶고 학년·반을 숫자 순으로 정렬한다", () => {
    const schools = groupRegisteredClasses([
      { schoolName: "경희여자중학교", grade: "3", classNumber: "1" },
      { schoolName: "경희여자중학교", grade: "1학년", classNumber: "6반" },
      { schoolName: "경희여자중학교", grade: "1", classNumber: "2" },
      { schoolName: "경희여자중학교", grade: "2학년", classNumber: "10반" },
      { schoolName: "경희여자중학교", grade: "2", classNumber: "9" },
    ]);
    expect(schools).toHaveLength(1);
    expect(schools[0].name).toBe("경희여자중학교");
    expect(schools[0].classes).toEqual([
      { grade: "1", classNumber: "2" },
      { grade: "1", classNumber: "6" },
      { grade: "2", classNumber: "9" },
      { grade: "2", classNumber: "10" },
      { grade: "3", classNumber: "1" },
    ]);
  });

  it("공백만 다른 학교명은 같은 학교로 본다", () => {
    const schools = groupRegisteredClasses([
      { schoolName: "경희여자중학교", grade: "1", classNumber: "1" },
      { schoolName: "경희 여자 중학교", grade: "1", classNumber: "2" },
    ]);
    expect(schools).toHaveLength(1);
    expect(schools[0].classes).toHaveLength(2);
  });

  it("글자가 다른 학교명은 다른 학교로 나뉜다 (2-6 사고 형태)", () => {
    // 이렇게 갈라져 보이면 교사 등록 화면에서 잘못 적힌 걸 알아챌 수 있다.
    const schools = groupRegisteredClasses([
      { schoolName: "경희여자중학교", grade: "2", classNumber: "5" },
      { schoolName: "경희여자중학", grade: "2", classNumber: "6" },
    ]);
    expect(schools.map((s) => s.name).sort()).toEqual(["경희여자중학", "경희여자중학교"]);
  });

  it("학년 목록과 반 목록을 뽑는다", () => {
    const [school] = groupRegisteredClasses([
      { schoolName: "A중", grade: "1", classNumber: "1" },
      { schoolName: "A중", grade: "1", classNumber: "3" },
      { schoolName: "A중", grade: "2", classNumber: "1" },
    ]);
    expect(gradesOf(school)).toEqual(["1", "2"]);
    expect(classNumbersOf(school, "1")).toEqual(["1", "3"]);
    expect(classNumbersOf(school, "2")).toEqual(["1"]);
    expect(classNumbersOf(school, "3")).toEqual([]);
    expect(gradesOf(undefined)).toEqual([]);
  });

  it("빈 학교명은 버린다", () => {
    expect(groupRegisteredClasses([{ schoolName: "  ", grade: "1", classNumber: "1" }])).toEqual([]);
  });
});
