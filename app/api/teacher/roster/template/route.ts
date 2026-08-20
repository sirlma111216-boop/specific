import { requireTeacher } from "@/lib/auth/server";
import { buildRosterTemplate } from "@/lib/excel/roster-excel";
import { ApiError } from "@/lib/api-error";

/** 학생 명단 엑셀 견본 다운로드 */
export async function GET(req: Request) {
  try {
    await requireTeacher(req);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : "서버 오류가 발생했습니다.";
    return Response.json({ error: message }, { status });
  }

  const buffer = await buildRosterTemplate();
  const filename = encodeURIComponent("학생명단_견본.xlsx");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roster-template.xlsx"; filename*=UTF-8''${filename}`,
      "Cache-Control": "no-store",
    },
  });
}
