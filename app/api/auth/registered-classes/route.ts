import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { route } from "@/lib/route-helpers";
import { normalizeSchoolName } from "@/lib/roster/normalize";
import { listRegisteredClasses } from "@/lib/roster/registered-classes";
import { SCHOOL_NAME } from "@/lib/school";
import type { ClassDoc } from "@/lib/types";

/**
 * 가입 화면용: 해당 학년도에 등록된 학년·반 목록.
 *
 * 로그인 전에 호출되므로 학년·반 번호만 내려주고 교사 이름·인원수·학급 id 는 담지 않는다.
 * 학생이 학년·반을 목록에서 고르게 해서, 없는 학급을 입력하고 "왜 안 되지" 하는 일을 없앤다.
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

    // 학교명이 고정되기 전에 다른 이름으로 등록된 학급이 있다면 학생이 어차피 대조하지
    // 못하므로 목록에서도 뺀다. (현재는 전부 같은 이름이다)
    const school = normalizeSchoolName(SCHOOL_NAME);
    const classes = listRegisteredClasses(
      snap.docs
        .map((d) => d.data() as ClassDoc)
        .filter((c) => normalizeSchoolName(c.schoolName) === school)
        .map((c) => ({ grade: c.grade, classNumber: c.classNumber })),
    );

    return { schoolYear, classes };
  });
}
