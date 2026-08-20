import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildRosterTemplate, parseRosterWorkbook } from "@/lib/excel/roster-excel";

/** 메모리에서 .xlsx를 만들어 업로드 상황을 흉내 낸다. */
async function makeWorkbook(
  rows: Array<Array<string | number | null>>,
  header: Array<string> | null = ["번호", "이름"],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("명단");
  if (header) ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe("엑셀 명단", () => {
  it("견본 파일을 만들고 다시 읽을 수 있다", async () => {
    const buffer = await buildRosterTemplate();
    const parsed = await parseRosterWorkbook(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    );
    expect(parsed.errors).toEqual([]);
    // 견본에는 예시 2명이 채워져 있고 나머지는 번호만 있는 빈 행이다
    expect(parsed.students.map((s) => s.studentName)).toEqual(["김민서", "이서준"]);
  });

  // 요구사항 테스트 2 (30명 업로드)
  it("학생 30명을 읽어들인다", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => [i + 1, `학생${i + 1}`]);
    const parsed = await parseRosterWorkbook(await makeWorkbook(rows));
    expect(parsed.errors).toEqual([]);
    expect(parsed.students).toHaveLength(30);
    expect(parsed.students[29]).toMatchObject({ studentNumber: 30, studentName: "학생30" });
  });

  it("열 순서가 바뀌어도 헤더 이름으로 찾는다", async () => {
    const parsed = await parseRosterWorkbook(
      await makeWorkbook([["김민서", 1]], ["이름", "번호"]),
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.students[0]).toMatchObject({ studentNumber: 1, studentName: "김민서" });
  });

  it("헤더 위에 제목 행이 있어도 찾는다", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("명단");
    ws.addRow(["2026학년도 3학년 2반 명단"]);
    ws.addRow([]);
    ws.addRow(["번호", "이름"]);
    ws.addRow([1, "김민서"]);
    const parsed = await parseRosterWorkbook((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(parsed.errors).toEqual([]);
    expect(parsed.students).toHaveLength(1);
  });

  it("필수 컬럼이 없으면 안내한다", async () => {
    const parsed = await parseRosterWorkbook(await makeWorkbook([["김민서"]], ["학생"]));
    expect(parsed.errors.join()).toContain("필수 컬럼");
  });

  it("번호 중복을 행 번호와 함께 알려준다", async () => {
    const parsed = await parseRosterWorkbook(
      await makeWorkbook([
        [1, "김민서"],
        [1, "이서준"],
      ]),
    );
    expect(parsed.errors.join()).toContain("3행");
    expect(parsed.errors.join()).toContain("중복");
  });

  it("엑셀이 아닌 데이터는 오류로 처리한다", async () => {
    const parsed = await parseRosterWorkbook(new TextEncoder().encode("not an xlsx").buffer);
    expect(parsed.errors.join()).toContain("읽을 수 없습니다");
  });
});
