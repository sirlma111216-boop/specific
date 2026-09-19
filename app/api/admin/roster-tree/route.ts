import { requireStaff } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { loadAllClasses, loadAllRoster, loadAllUsers } from "@/lib/admin/lookup";
import { normalizeGradeOrClass } from "@/lib/roster/normalize";
import { formatClassName, formatGrade } from "@/lib/utils";
import type { RosterDoc } from "@/lib/types";

/**
 * '활동 입력' 화면의 학생 트리 — 학년 → 반 → 학생.
 *
 * 세 컬렉션을 전부 읽지만 모두 10분 캐시를 쓰는 공용 로더라, 화면을 여러 번 열어도
 * 읽기가 다시 나가지 않는다. 검색은 브라우저에서 이 목록 안에서 한다. (요청을 만들지 않는다)
 * 테스트 학급도 함께 내려준다. 실제로 어떻게 반영되는지 시험해 볼 수 있어야 하기 때문이다.
 */
export async function GET(req: Request) {
  return route(async () => {
    await requireStaff(req);

    const [classes, roster, users] = await Promise.all([
      loadAllClasses(),
      loadAllRoster(),
      loadAllUsers(),
    ]);

    // 학급별 학생 모으기
    const byClass = new Map<string, RosterDoc[]>();
    for (const r of roster.values()) {
      const list = byClass.get(r.classId);
      if (list) list.push(r);
      else byClass.set(r.classId, [r]);
    }

    const classNodes = [...classes.values()].map((c) => ({
      classId: c.classId,
      grade: c.grade,
      classNumber: c.classNumber,
      label: formatClassName(c.grade, c.classNumber),
      teacherName: c.teacherName,
      isTest: Boolean(c.isTest),
      schoolYear: c.schoolYear,
      students: (byClass.get(c.classId) ?? [])
        .sort((a, b) => a.studentNumber - b.studentNumber)
        .map((r) => ({
          rosterId: r.rosterId,
          studentNumber: r.studentNumber,
          studentName: r.studentName,
          // 아이디(로그인 이메일)로도 찾을 수 있어야 한다. 가입 전이면 없다.
          email: r.linkedUserId ? (users.get(r.linkedUserId)?.email ?? null) : null,
          signupStatus: r.signupStatus,
        })),
    }));

    // 학년 묶음. "1", "1학년"처럼 섞여 입력돼 있으므로 정규화한 값으로 묶는다.
    const gradeMap = new Map<string, typeof classNodes>();
    for (const node of classNodes) {
      const key = normalizeGradeOrClass(node.grade) || node.grade;
      const list = gradeMap.get(key);
      if (list) list.push(node);
      else gradeMap.set(key, [node]);
    }

    const num = (v: string) => {
      const n = Number(normalizeGradeOrClass(v));
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };

    const grades = [...gradeMap.entries()]
      .sort((a, b) => num(a[0]) - num(b[0]) || a[0].localeCompare(b[0], "ko"))
      .map(([key, list]) => ({
        grade: key,
        label: formatGrade(key),
        classes: list.sort(
          (a, b) =>
            Number(a.isTest) - Number(b.isTest) ||
            num(a.classNumber) - num(b.classNumber) ||
            a.classNumber.localeCompare(b.classNumber, "ko"),
        ),
      }));

    return { grades };
  });
}
