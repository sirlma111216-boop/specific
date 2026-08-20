import { badRequest } from "@/lib/api-error";
import { requireTeacher } from "@/lib/auth/server";
import { parseRosterWorkbook } from "@/lib/excel/roster-excel";
import { route } from "@/lib/route-helpers";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * 업로드된 엑셀을 파싱만 해서 돌려준다. 저장은 하지 않는다.
 * 교사가 미리보기에서 확인한 뒤 '등록하기'를 눌러야 실제로 저장된다.
 */
export async function POST(req: Request) {
  return route(async () => {
    await requireTeacher(req);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw badRequest("파일 업로드를 읽을 수 없습니다.");
    }

    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("엑셀 파일을 선택해주세요.");
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw badRequest("지원하지 않는 파일 형식입니다. .xlsx 파일을 올려주세요.", "bad_format");
    }
    if (file.size === 0) throw badRequest("빈 파일입니다.");
    if (file.size > MAX_BYTES) throw badRequest("파일이 너무 큽니다. (최대 2MB)");

    const result = await parseRosterWorkbook(await file.arrayBuffer());
    return {
      students: result.students.map((s) => ({
        studentNumber: s.studentNumber,
        studentName: s.studentName,
      })),
      errors: result.errors,
      scannedRows: result.scannedRows,
    };
  });
}
