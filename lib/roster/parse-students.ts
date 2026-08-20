import { normalizeStudentName } from "./normalize";

export interface RawStudentRow {
  studentNumber: unknown;
  studentName: unknown;
  /** 엑셀 원본 행 번호(오류 안내용). 직접 입력은 생략 가능 */
  sourceRow?: number;
}

export interface ParsedStudent {
  studentNumber: number;
  studentName: string;
  studentNameNorm: string;
}

export interface RosterParseResult {
  students: ParsedStudent[];
  errors: string[];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[번\s]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  // ExcelJS의 rich text / hyperlink 셀 대응
  if (typeof value === "object" && value !== null) {
    const obj = value as { text?: unknown; result?: unknown };
    if (typeof obj.text === "string") return obj.text.trim();
    if (typeof obj.result === "string") return obj.result.trim();
  }
  return String(value).trim();
}

/**
 * 명단 행을 검증한다. 직접 입력과 엑셀 업로드가 같은 규칙을 쓰도록 한 곳에 모은다.
 * 검사 항목: 이름 누락 / 번호 누락 / 번호 형식 / 번호 중복 / 같은 학생 중복.
 */
export function parseStudentRows(rows: RawStudentRow[]): RosterParseResult {
  const errors: string[] = [];
  const students: ParsedStudent[] = [];
  const seenNumbers = new Map<number, number>();
  const seenPeople = new Map<string, number>();

  rows.forEach((row, index) => {
    const label = row.sourceRow ? `${row.sourceRow}행` : `${index + 1}번째 줄`;
    const name = toText(row.studentName);
    const number = toNumber(row.studentNumber);
    const numberRaw = toText(row.studentNumber);

    // 완전히 빈 행은 조용히 건너뛴다 (엑셀에서 흔함)
    if (name === "" && numberRaw === "") return;

    if (numberRaw === "") {
      errors.push(`${label}: 번호가 비어 있습니다.`);
      return;
    }
    if (number === null || !Number.isInteger(number) || number <= 0) {
      errors.push(`${label}: 번호는 1 이상의 정수여야 합니다. (입력값: ${numberRaw})`);
      return;
    }
    if (name === "") {
      errors.push(`${label}: 이름이 비어 있습니다.`);
      return;
    }

    const prevNumberRow = seenNumbers.get(number);
    if (prevNumberRow !== undefined) {
      errors.push(`${label}: ${number}번이 중복됩니다. (앞선 행: ${prevNumberRow})`);
      return;
    }

    const nameNorm = normalizeStudentName(name);
    const personKey = `${number}|${nameNorm}`;
    const prevPersonRow = seenPeople.get(personKey);
    if (prevPersonRow !== undefined) {
      errors.push(`${label}: 같은 학생(${number}번 ${name})이 중복 등록되었습니다.`);
      return;
    }

    seenNumbers.set(number, row.sourceRow ?? index + 1);
    seenPeople.set(personKey, row.sourceRow ?? index + 1);
    students.push({ studentNumber: number, studentName: name, studentNameNorm: nameNorm });
  });

  if (students.length === 0 && errors.length === 0) {
    errors.push("등록할 학생이 없습니다.");
  }

  students.sort((a, b) => a.studentNumber - b.studentNumber);
  return { students, errors };
}
