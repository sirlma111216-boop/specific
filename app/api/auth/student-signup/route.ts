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

/**
 * 두 단계의 실패를 다른 문장으로 알린다.
 * 학급 자체가 없는 것과 명단에 없는 것을 같은 문장으로 알리면 담임이 원인을 찾지 못한다.
 * (2026-09 2학년 6반: 학교명 오타로 24명 전원이 막혔는데 학생들은 "정보 불일치"만 봤다)
 * 학급 유무는 가입 화면 목록에도 보이는 정보라 알려줘도 새어 나가는 게 없다.
 * 명단 단계는 번호·이름을 대조하므로 어느 쪽이 틀렸는지는 알리지 않는다.
 */
const CLASS_NOT_FOUND_MESSAGE =
  "입력한 학년도·학교·학년·반으로 등록된 학급이 없습니다. 담임 선생님께 학급이 등록되어 있는지, 학교명이 정확한지 확인해주세요.";
const MISMATCH_MESSAGE =
  "학급 명단에서 번호와 이름이 일치하는 학생을 찾지 못했습니다. 명단에 적힌 그대로 입력했는지 확인하거나 담임 선생님께 문의해주세요.";

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
    if (classSnap.size !== 1) throw badRequest(CLASS_NOT_FOUND_MESSAGE, "class_not_found");
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
