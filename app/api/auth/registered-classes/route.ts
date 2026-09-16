import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { route } from "@/lib/route-helpers";
import { groupRegisteredClasses } from "@/lib/roster/registered-classes";
import type { ClassDoc } from "@/lib/types";

/**
 * 가입 화면용: 해당 학년도에 등록된 학교와 학년·반 목록.
 *
 * 로그인 전에 호출되므로 학교명·학년·반 번호만 내려주고, 교사 이름·인원수·학급 id 등은
 * 절대 담지 않는다. 학생이 학교명을 타이핑하다 틀리는 일과, 교사가 이미 있는 학교명을
 * 다르게 적는 일(2026-09 2학년 6반 사고)을 막기 위한 목록이다.
 */
export async function GET(req: Request) {
  return route(async () => {
    const raw = new URL(req.url).searchParams.get("schoolYear") ?? "";
    const schoolYear = Number(raw);
    if (!Number.isInteger(schoolYear) || schoolYear < 2000 || schoolYear > 2100) {
      throw badRequest("학년도를 올바르게 입력해주세요. (예: 2026)");
    }

    const snap = await adminDb()
      .collection(COL.classes)
      .where("schoolYear", "==", schoolYear)
      .get();

    const schools = groupRegisteredClasses(
      snap.docs.map((d) => {
        const c = d.data() as ClassDoc;
        return { schoolName: c.schoolName, grade: c.grade, classNumber: c.classNumber };
      }),
    );

    return { schoolYear, schools };
  });
}
