import { requireAdmin } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import {
  loadAllClasses,
  loadAllRoster,
  loadAllUsers,
  sortClassSummaries,
  summarizeAccount,
  summarizeClass,
  type AccountSummary,
  type ClassSummary,
} from "@/lib/admin/lookup";
import { formatClassFull } from "@/lib/utils";
import type { RosterDoc } from "@/lib/types";

/**
 * 관리자 대시보드. 학급·계정·명단을 한 번씩 읽어 어긋난 것을 찾아낸다.
 * (학급 20 + 계정 350 + 명단 400 ≈ 770 읽기. 관리자가 가끔 보는 화면이라 감당된다)
 */
export async function GET(req: Request) {
  return route(async () => {
    await requireAdmin(req);
    const [users, classes, roster] = await Promise.all([
      loadAllUsers(),
      loadAllClasses(),
      loadAllRoster(),
    ]);

    const rosterByClass = new Map<string, RosterDoc[]>();
    for (const r of roster.values()) {
      const list = rosterByClass.get(r.classId) ?? [];
      list.push(r);
      rosterByClass.set(r.classId, list);
    }

    const classSummaries: ClassSummary[] = sortClassSummaries(
      Array.from(classes.values()).map((c) => summarizeClass(c, users, rosterByClass.get(c.classId) ?? [])),
    );

    const label = (c: { schoolYear: number; grade: string; classNumber: string }) =>
      formatClassFull(c.schoolYear, c.grade, c.classNumber);
    const accounts: AccountSummary[] = Array.from(users.entries()).map(([uid, u]) =>
      summarizeAccount(uid, u, classes, roster, label),
    );

    const problems = accounts.filter((a) => a.problem);
    const teachers = accounts.filter((a) => a.role === "teacher");
    const students = accounts.filter((a) => a.role === "student");
    const realRoster = Array.from(roster.values()).filter((r) => !classes.get(r.classId)?.isTest);

    return {
      counts: {
        classes: classSummaries.filter((c) => !c.isTest).length,
        testClasses: classSummaries.filter((c) => c.isTest).length,
        teachers: teachers.length,
        students: students.length,
        rosterTotal: realRoster.length,
        rosterLinked: realRoster.filter((r) => r.signupStatus === "linked").length,
      },
      classes: classSummaries,
      problems,
      classesWithoutTeacher: classSummaries.filter((c) => c.teacherMissing),
    };
  });
}
