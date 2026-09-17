import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { forgetUser, requireStudent } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { STUDENT_RESET_PASSWORD } from "@/lib/school";

interface Body {
  password?: string;
}

/**
 * 학생이 새 비밀번호를 정한다. 초기화된 비밀번호로 들어온 뒤 처음 하는 일이다.
 * (초기화 표시가 없는 학생도 쓸 수 있다 — 스스로 바꾸고 싶을 때)
 */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireStudent(req, { allowPendingPassword: true });
    const body = await readJson<Body>(req);
    const password = body.password ?? "";

    if (password.length < 6) throw badRequest("비밀번호는 6자 이상이어야 합니다.");
    if (password === STUDENT_RESET_PASSWORD) {
      throw badRequest("초기화 비밀번호와 다른 것으로 정해주세요.");
    }

    await adminAuth().updateUser(ctx.uid, { password });
    await adminDb().collection(COL.users).doc(ctx.uid).update({ mustChangePassword: false });
    forgetUser(ctx.uid);
    return { ok: true };
  });
}
