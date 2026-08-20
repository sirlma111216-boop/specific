import { adminDb, COL } from "@/lib/firebase/admin";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { safeCount } from "@/lib/events/counters";
import type { RosterDoc, StudentListItem } from "@/lib/types";

/**
 * 학급 전체 학생 목록 + 가입 상태 + 영역별 기록 수.
 *
 * 기록 수는 roster 문서에 비정규화해 둔 값을 그대로 쓴다.
 * (예전에는 반 전체 소감·교사기록을 읽어 세느라 목록 한 번에 수백 건을 읽었다.
 *  Firestore 무료 등급의 하루 읽기 한도를 지키려면 명단 문서만 읽어야 한다.)
 */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);

    const rosterSnap = await adminDb()
      .collection(COL.roster)
      .where("classId", "==", ctx.classId)
      .get();

    const students: StudentListItem[] = rosterSnap.docs
      .map((d) => d.data() as RosterDoc)
      .map((r) => ({
        rosterId: r.rosterId,
        studentNumber: r.studentNumber,
        studentName: r.studentName,
        signupStatus: r.signupStatus,
        autonomousCount: safeCount(r.autonomousCount),
        careerCount: safeCount(r.careerCount),
      }))
      .sort((a, b) => a.studentNumber - b.studentNumber);

    return { students };
  });
}
