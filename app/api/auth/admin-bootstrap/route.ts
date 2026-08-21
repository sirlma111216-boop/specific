import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { readJson, route } from "@/lib/route-helpers";
import type { UserDoc } from "@/lib/types";

interface Body {
  email?: string;
  password?: string;
}

/**
 * 관리자 계정 준비.
 *
 * 관리자는 회원가입하지 않는다. ADMIN_EMAIL / ADMIN_PASSWORD 로 지정되어 있고,
 * 처음 로그인할 때 이 라우트가 계정을 만들어 준다. 이후에는 이미 있으므로 그대로 통과한다.
 *
 * 로그인 화면은 로그인이 실패했을 때만 이 라우트를 부르므로,
 * 일반 교사·학생 로그인 흐름에는 영향이 없다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const body = await readJson<Body>(req);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD ?? "";

    // 관리자 계정이 서버에 설정되어 있지 않거나, 값이 맞지 않으면 아무것도 알려주지 않는다.
    // (어떤 이메일이 관리자인지 밖에서 알아낼 수 없게 한다)
    if (!adminEmail || !adminPassword) throw badRequest("로그인에 실패했습니다.");
    if (email !== adminEmail || password !== adminPassword) {
      throw badRequest("로그인에 실패했습니다.");
    }

    const auth = adminAuth();
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(adminEmail);
      uid = existing.uid;
      // 환경변수의 비밀번호가 바뀌었으면 맞춰 준다.
      await auth.updateUser(uid, { password: adminPassword });
    } catch {
      const created = await auth.createUser({ email: adminEmail, password: adminPassword });
      uid = created.uid;
    }

    await auth.setCustomUserClaims(uid, { role: "admin" });

    const ref = adminDb().collection(COL.users).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const doc: UserDoc = {
        uid,
        role: "admin",
        email: adminEmail,
        createdAt: Date.now(),
        classId: null,
      };
      await ref.set(doc);
    } else if ((snap.data() as UserDoc).role !== "admin") {
      await ref.update({ role: "admin", classId: null });
    }

    return { ok: true };
  });
}
