import { describe, expect, it } from "vitest";
import {
  classNumbersOf,
  gradesOf,
  listRegisteredClasses,
} from "@/lib/roster/registered-classes";

describe("등록된 학급 목록", () => {
  it("학년·반을 숫자 순으로 정렬하고 표기 차이를 흡수한다", () => {
    const classes = listRegisteredClasses([
      { grade: "3", classNumber: "1" },
      { grade: "1학년", classNumber: "6반" },
      { grade: "1", classNumber: "2" },
      { grade: "2학년", classNumber: "10반" },
      { grade: "2", classNumber: "9" },
    ]);
    expect(classes).toEqual([
      { grade: "1", classNumber: "2" },
      { grade: "1", classNumber: "6" },
      { grade: "2", classNumber: "9" },
      { grade: "2", classNumber: "10" },
      { grade: "3", classNumber: "1" },
    ]);
  });

  it("같은 학급이 두 번 있어도 하나로 센다", () => {
    const classes = listRegisteredClasses([
      { grade: "2", classNumber: "6" },
      { grade: "2학년", classNumber: "6반" },
    ]);
    expect(classes).toHaveLength(1);
  });

  it("학년 목록과 반 목록을 뽑는다", () => {
    const classes = listRegisteredClasses([
      { grade: "1", classNumber: "1" },
      { grade: "1", classNumber: "3" },
      { grade: "2", classNumber: "1" },
    ]);
    expect(gradesOf(classes)).toEqual(["1", "2"]);
    expect(classNumbersOf(classes, "1")).toEqual(["1", "3"]);
    expect(classNumbersOf(classes, "2")).toEqual(["1"]);
    expect(classNumbersOf(classes, "3")).toEqual([]);
  });

  it("학년이나 반이 비면 버린다", () => {
    expect(listRegisteredClasses([{ grade: "", classNumber: "1" }])).toEqual([]);
  });
});
