import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { readJson, route } from "@/lib/route-helpers";
import type { UserDoc } from "@/lib/types";

interface Body {
  email?: string;
  password?: string;
  code?: string;
  teacherName?: string;
}

/**
 * 교사 회원가입.
 * 학생이 임의로 교사 계정을 만들 수 없도록 TEACHER_SIGNUP_CODE와 일치할 때만 생성한다.
 * 향후 관리자 승인 방식으로 바꾸려면 이 라우트의 코드 검증 부분만 교체하면 된다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const body = await readJson<Body>(req);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const signupCode = (body.code ?? "").trim();

    if (!email || !password) throw badRequest("이메일과 비밀번호를 입력해주세요.");
    if (password.length < 6) throw badRequest("비밀번호는 6자 이상이어야 합니다.");

    const expected = (process.env.TEACHER_SIGNUP_CODE ?? "").trim();
    if (!expected) {
      throw badRequest(
        "서버에 교사용 가입 코드가 설정되어 있지 않습니다. 관리자에게 문의해주세요.",
        "no_signup_code",
      );
    }
    if (signupCode !== expected) throw badRequest("교사용 가입 코드가 올바르지 않습니다.");

    let uid: string;
    try {
      const user = await adminAuth().createUser({ email, password });
      uid = user.uid;
    } catch (err) {
      throw translateAuthError(err);
    }

    try {
      await adminAuth().setCustomUserClaims(uid, { role: "teacher" });
      const doc: UserDoc = {
        uid,
        role: "teacher",
        email,
        createdAt: Date.now(),
        classId: null,
        teacherName: (body.teacherName ?? "").trim(),
      };
      await adminDb().collection(COL.users).doc(uid).set(doc);
    } catch (err) {
      // 계정만 남고 프로필 문서가 없는 상태를 남기지 않는다.
      await adminAuth().deleteUser(uid).catch(() => {});
      throw err;
    }

    return { ok: true };
  });
}

function translateAuthError(err: unknown): unknown {
  const code = (err as { code?: string }).code ?? "";
  if (code === "auth/email-already-exists") {
    return badRequest("이미 가입된 이메일입니다. 로그인해주세요.");
  }
  if (code === "auth/invalid-email") return badRequest("이메일 형식이 올바르지 않습니다.");
  if (code === "auth/invalid-password") return badRequest("비밀번호는 6자 이상이어야 합니다.");
  return err;
}
