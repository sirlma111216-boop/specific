import "server-only";

import ExcelJS from "exceljs";
import { parseStudentRows, type RawStudentRow, type RosterParseResult } from "@/lib/roster/parse-students";

const NUMBER_HEADERS = ["번호", "번", "no", "no.", "number", "학생번호", "출석번호"];
const NAME_HEADERS = ["이름", "성명", "name", "학생이름", "학생명"];

function headerKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** 학생 명단 견본 .xlsx 를 만든다. 교사가 받아서 이름만 채워 다시 올린다. */
export async function buildRosterTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "생기부 자율·진로 기록 도우미";
  const ws = wb.addWorksheet("학생명단");

  ws.columns = [
    { header: "번호", key: "number", width: 10 },
    { header: "이름", key: "name", width: 20 },
  ];

  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;

  // 예시 2줄만 넣는다. 번호만 미리 채운 빈 줄을 두면 교사가 다 채우지 않았을 때
  // "이름이 비어 있습니다" 오류가 무더기로 나므로 두지 않는다.
  ws.addRow({ number: 1, name: "김민서" });
  ws.addRow({ number: 2, name: "이서준" });

  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });
  });

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export interface ExcelParseOutcome extends RosterParseResult {
  /** 파일에서 실제로 읽은 데이터 행 수 (빈 행 제외 전) */
  scannedRows: number;
}

/**
 * 업로드된 .xlsx에서 번호/이름 열을 찾아 학생 명단을 읽는다.
 * 헤더 행은 위에서부터 20행 이내에서 탐색하며, 열 순서가 달라도 헤더 이름으로 찾는다.
 */
export async function parseRosterWorkbook(buffer: ArrayBuffer): Promise<ExcelParseOutcome> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return {
      students: [],
      errors: ["엑셀 파일(.xlsx)을 읽을 수 없습니다. 견본 파일을 내려받아 다시 작성해주세요."],
      scannedRows: 0,
    };
  }

  const ws = wb.worksheets[0];
  if (!ws) {
    return { students: [], errors: ["시트가 비어 있습니다."], scannedRows: 0 };
  }

  let headerRowNumber = 0;
  let numberCol = 0;
  let nameCol = 0;

  const limit = Math.min(ws.rowCount, 20);
  for (let r = 1; r <= limit; r += 1) {
    const row = ws.getRow(r);
    let foundNumber = 0;
    let foundName = 0;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headerKey(cell.value);
      if (!foundNumber && NUMBER_HEADERS.includes(key)) foundNumber = col;
      if (!foundName && NAME_HEADERS.includes(key)) foundName = col;
    });
    if (foundNumber && foundName) {
      headerRowNumber = r;
      numberCol = foundNumber;
      nameCol = foundName;
      break;
    }
  }

  if (!headerRowNumber) {
    return {
      students: [],
      errors: [
        "필수 컬럼을 찾지 못했습니다. 첫 행에 '번호'와 '이름' 열이 있어야 합니다. 견본 파일을 사용해주세요.",
      ],
      scannedRows: 0,
    };
  }

  const raw: RawStudentRow[] = [];
  for (let r = headerRowNumber + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    raw.push({
      studentNumber: row.getCell(numberCol).value,
      studentName: row.getCell(nameCol).value,
      sourceRow: r,
    });
  }

  const result = parseStudentRows(raw);
  return { ...result, scannedRows: raw.length };
}
