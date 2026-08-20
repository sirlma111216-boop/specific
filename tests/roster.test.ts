import { describe, expect, it } from "vitest";
import {
  buildClassMatchKey,
  normalizeGradeOrClass,
  normalizeSchoolName,
  normalizeStudentName,
} from "@/lib/roster/normalize";
import { parseStudentRows } from "@/lib/roster/parse-students";

describe("정규화", () => {
  it("학교명은 공백 차이만 흡수한다", () => {
    expect(normalizeSchoolName("서울중학교")).toBe(normalizeSchoolName("서울 중학교"));
    expect(normalizeSchoolName(" 서울중학교 ")).toBe(normalizeSchoolName("서울중학교"));
  });

  it("학교명 약칭은 같은 값으로 보지 않는다", () => {
    expect(normalizeSchoolName("서울중")).not.toBe(normalizeSchoolName("서울중학교"));
  });

  it("학년/반은 숫자만 뽑아 맞춘다", () => {
    expect(normalizeGradeOrClass("3학년")).toBe("3");
    expect(normalizeGradeOrClass("3 학년")).toBe("3");
    expect(normalizeGradeOrClass("03")).toBe("3");
    expect(normalizeGradeOrClass("2반")).toBe("2");
  });

  it("이름은 공백만 제거하고 유사도 보정을 하지 않는다", () => {
    expect(normalizeStudentName("김 민서")).toBe("김민서");
    expect(normalizeStudentName("김민서")).not.toBe(normalizeStudentName("김민석"));
  });

  it("자모 분리(NFD) 입력도 같은 이름으로 인식한다", () => {
    const nfd = "김민서".normalize("NFD");
    expect(normalizeStudentName(nfd)).toBe(normalizeStudentName("김민서"));
  });

  it("학급 키는 표기가 달라도 같은 학급이면 일치한다", () => {
    const a = buildClassMatchKey({
      schoolYear: 2026,
      schoolName: "○○중학교",
      grade: "3학년",
      classNumber: "2반",
    });
    const b = buildClassMatchKey({
      schoolYear: 2026,
      schoolName: "○○ 중학교",
      grade: "3",
      classNumber: "2",
    });
    expect(a).toBe(b);
  });

  it("반이 다르면 학급 키가 달라진다", () => {
    const a = buildClassMatchKey({
      schoolYear: 2026,
      schoolName: "○○중학교",
      grade: "3학년",
      classNumber: "2반",
    });
    const c = buildClassMatchKey({
      schoolYear: 2026,
      schoolName: "○○중학교",
      grade: "3학년",
      classNumber: "3반",
    });
    expect(a).not.toBe(c);
  });
});

describe("명단 파싱", () => {
  it("정상 명단을 번호순으로 정리한다", () => {
    const result = parseStudentRows([
      { studentNumber: 2, studentName: "이서준" },
      { studentNumber: 1, studentName: "김민서" },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.students.map((s) => s.studentNumber)).toEqual([1, 2]);
  });

  it("빈 행은 조용히 건너뛴다", () => {
    const result = parseStudentRows([
      { studentNumber: 1, studentName: "김민서" },
      { studentNumber: "", studentName: "" },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.students).toHaveLength(1);
  });

  it("이름 누락을 잡아낸다", () => {
    const result = parseStudentRows([{ studentNumber: 1, studentName: "  " }]);
    expect(result.errors.join()).toContain("이름이 비어 있습니다");
  });

  it("번호 누락을 잡아낸다", () => {
    const result = parseStudentRows([{ studentNumber: "", studentName: "김민서" }]);
    expect(result.errors.join()).toContain("번호가 비어 있습니다");
  });

  it("번호 형식 오류를 잡아낸다", () => {
    const result = parseStudentRows([{ studentNumber: "일번", studentName: "김민서" }]);
    expect(result.errors.join()).toContain("1 이상의 정수");
  });

  it("번호 중복을 잡아낸다", () => {
    const result = parseStudentRows([
      { studentNumber: 1, studentName: "김민서" },
      { studentNumber: 1, studentName: "이서준" },
    ]);
    expect(result.errors.join()).toContain("중복");
  });

  it("같은 학생 중복 등록을 잡아낸다", () => {
    const result = parseStudentRows([
      { studentNumber: 1, studentName: "김민서" },
      { studentNumber: 1, studentName: "김 민서" },
    ]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("'1번'처럼 단위가 붙은 번호도 읽는다", () => {
    const result = parseStudentRows([{ studentNumber: "1번", studentName: "김민서" }]);
    expect(result.errors).toEqual([]);
    expect(result.students[0].studentNumber).toBe(1);
  });

  it("학생이 하나도 없으면 오류로 처리한다", () => {
    const result = parseStudentRows([]);
    expect(result.errors.join()).toContain("등록할 학생이 없습니다");
  });
});
