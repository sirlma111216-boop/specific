import { adminDb, COL } from "@/lib/firebase/admin";
import { getAuthContext } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import type { ClassDoc, RosterDoc } from "@/lib/types";

/** 로그인 후 어느 화면으로 보낼지 결정하기 위한 최소 정보. */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await getAuthContext(req);
    const db = adminDb();

    let klass: ClassDoc | null = null;
    if (ctx.classId) {
      const snap = await db.collection(COL.classes).doc(ctx.classId).get();
      klass = snap.exists ? (snap.data() as ClassDoc) : null;
    }

    let student: { studentNumber: number; studentName: string } | null = null;
    if (ctx.role === "student" && ctx.rosterId) {
      const snap = await db.collection(COL.roster).doc(ctx.rosterId).get();
      if (snap.exists) {
        const r = snap.data() as RosterDoc;
        student = { studentNumber: r.studentNumber, studentName: r.studentName };
      }
    }

    return {
      uid: ctx.uid,
      role: ctx.role,
      email: ctx.email,
      needsOnboarding: ctx.role === "teacher" && !ctx.classId,
      klass: klass
        ? {
            classId: klass.classId,
            schoolYear: klass.schoolYear,
            schoolName: klass.schoolName,
            grade: klass.grade,
            classNumber: klass.classNumber,
            teacherName: klass.teacherName,
          }
        : null,
      student,
    };
  });
}
