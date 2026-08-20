import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { readJson, route } from "@/lib/route-helpers";
import { buildClassMatchKey, normalizeStudentName } from "@/lib/roster/normalize";
import type { ClassDoc, RosterDoc, UserDoc } from "@/lib/types";

interface Body {
  email?: string;
  password?: string;
  schoolYear?: string | number;
  schoolName?: string;
  grade?: string;
  classNumber?: string;
  studentNumber?: string | number;
  studentName?: string;
}

const MISMATCH_MESSAGE =
  "등록된 학급 명단과 정보가 일치하지 않습니다. 입력한 학년도, 학교, 학년, 반, 번호, 이름을 확인해주세요.";

/**
 * 학생 회원가입 = 교사가 미리 등록한 명단과의 연결.
 * 학생은 학급이나 명단을 스스로 만들 수 없고, 정확히 한 명과 일치할 때만 계정이 생성된다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const body = await readJson<Body>(req);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const schoolYear = Number(body.schoolYear);
    const studentNumber = Number(body.studentNumber);
    const studentName = (body.studentName ?? "").trim();

    if (!email || !password) throw badRequest("이메일과 비밀번호를 입력해주세요.");
    if (password.length < 6) throw badRequest("비밀번호는 6자 이상이어야 합니다.");
    if (!Number.isInteger(schoolYear) || schoolYear < 2000 || schoolYear > 2100) {
      throw badRequest("학년도를 올바르게 입력해주세요. (예: 2026)");
    }
    if (!Number.isInteger(studentNumber) || studentNumber <= 0) {
      throw badRequest("번호를 올바르게 입력해주세요.");
    }
    if (!studentName) throw badRequest("이름을 입력해주세요.");

    const db = adminDb();
    const matchKey = buildClassMatchKey({
      schoolYear,
      schoolName: body.schoolName ?? "",
      grade: body.grade ?? "",
      classNumber: body.classNumber ?? "",
    });

    const classSnap = await db.collection(COL.classes).where("matchKey", "==", matchKey).get();
    if (classSnap.size !== 1) throw badRequest(MISMATCH_MESSAGE, "roster_mismatch");
    const klass = classSnap.docs[0].data() as ClassDoc;

    // 번호로 좁힌 뒤 정규화된 이름을 정확히 비교한다. 유사도 매칭은 하지 않는다.
    const rosterSnap = await db
      .collection(COL.roster)
      .where("classId", "==", klass.classId)
      .where("studentNumber", "==", studentNumber)
      .get();

    const nameNorm = normalizeStudentName(studentName);
    const matches = rosterSnap.docs.filter(
      (d) => (d.data() as RosterDoc).studentNameNorm === nameNorm,
    );
    if (matches.length !== 1) throw badRequest(MISMATCH_MESSAGE, "roster_mismatch");

    const rosterRef = matches[0].ref;
    const roster = matches[0].data() as RosterDoc;
    if (roster.signupStatus === "linked" && roster.linkedUserId) {
      throw badRequest(
        "이미 가입이 완료된 학생입니다. 기존 계정으로 로그인하거나 담임 선생님께 문의해주세요.",
        "already_linked",
      );
    }

    let uid: string;
    try {
      const user = await adminAuth().createUser({ email, password });
      uid = user.uid;
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-exists") {
        throw badRequest("이미 가입된 이메일입니다. 로그인해주세요.");
      }
      if (code === "auth/invalid-email") throw badRequest("이메일 형식이 올바르지 않습니다.");
      if (code === "auth/invalid-password") throw badRequest("비밀번호는 6자 이상이어야 합니다.");
      throw err;
    }

    try {
      await adminAuth().setCustomUserClaims(uid, { role: "student" });
      // 두 계정이 동시에 같은 명단 행을 잡지 않도록 트랜잭션으로 연결한다.
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(rosterRef);
        const data = fresh.data() as RosterDoc;
        if (data.signupStatus === "linked" && data.linkedUserId) {
          throw badRequest("이미 가입이 완료된 학생입니다.", "already_linked");
        }
        tx.update(rosterRef, { signupStatus: "linked", linkedUserId: uid });
        const userDoc: UserDoc = {
          uid,
          role: "student",
          email,
          createdAt: Date.now(),
          classId: klass.classId,
          rosterId: data.rosterId,
        };
        tx.set(db.collection(COL.users).doc(uid), userDoc);
      });
    } catch (err) {
      await adminAuth().deleteUser(uid).catch(() => {});
      throw err;
    }

    return { ok: true };
  });
}
