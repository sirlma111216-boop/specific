import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { forgetUser, requireTeacherWithClass } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { STUDENT_RESET_PASSWORD } from "@/lib/school";
import type { RosterDoc, UserDoc } from "@/lib/types";

/**
 * 담임이 학생 비밀번호를 초기화한다.
 *
 * 비밀번호는 정해진 값(STUDENT_RESET_PASSWORD)이 되고, 학생 계정에 "다음 로그인 때
 * 새 비밀번호를 정해야 함" 표시가 붙는다. 그 전까지 학생은 다른 화면을 쓰지 못한다.
 * 담임은 자기 학급 학생만 초기화할 수 있다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ rosterId: string }> }) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const { rosterId } = await params;
    const db = adminDb();

    const rosterSnap = await db.collection(COL.roster).doc(rosterId).get();
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const roster = rosterSnap.data() as RosterDoc;
    if (roster.classId !== ctx.classId) throw notFound("학생을 찾을 수 없습니다.");
    if (!roster.linkedUserId) throw badRequest("아직 가입하지 않은 학생입니다. 초기화할 비밀번호가 없습니다.");

    const userRef = db.collection(COL.users).doc(roster.linkedUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists || (userSnap.data() as UserDoc).rosterId !== rosterId) {
      throw notFound("학생 계정을 찾을 수 없습니다.");
    }

    await adminAuth().updateUser(roster.linkedUserId, { password: STUDENT_RESET_PASSWORD });
    await userRef.update({ mustChangePassword: true });
    forgetUser(roster.linkedUserId);

    return { ok: true, password: STUDENT_RESET_PASSWORD };
  });
}
