import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { readJson, route } from "@/lib/route-helpers";
import { buildClassMatchKey, normalizeStudentName } from "@/lib/roster/normalize";
import { SCHOOL_NAME } from "@/lib/school";
import { formatClassName } from "@/lib/utils";
import type { ClassDoc, RosterDoc, UserDoc } from "@/lib/types";

interface Body {
  email?: string;
  password?: string;
  schoolYear?: string | number;
  grade?: string;
  classNumber?: string;
  studentNumber?: string | number;
  studentName?: string;
}

/**
 * 실패 단계마다 다른 문장으로, 누가 무엇을 고쳐야 하는지까지 알린다.
 * 2026-09 2학년 6반: 담임의 학교명 오타로 24명 전원이 막혔는데 학생들은
 * "정보 불일치"만 보고 "그냥 안 된다"고 했다. 원인이 교사 쪽 등록인지
 * 학생 쪽 입력인지 문장만 보고 알 수 있어야 한다.
 *
 * 번호 유무를 알려주는 것은 반 안에서 번호가 1~N번으로 뻔히 있으므로 새는 정보가 아니다.
 * 이름이 다르다고만 알리고 명단의 실제 이름은 어떤 경우에도 내려주지 않는다.
 */
function classNotFound(schoolYear: number, grade: string, classNumber: string) {
  return badRequest(
    `${schoolYear}학년도 ${formatClassName(grade, classNumber)}은(는) 아직 등록되지 않았습니다. 담임 선생님이 학급을 등록해야 가입할 수 있습니다. 담임 선생님께 알려주세요.`,
    "class_not_found",
  );
}
function numberNotInRoster(grade: string, classNumber: string, studentNumber: number) {
  return badRequest(
    `${formatClassName(grade, classNumber)} 명단에 ${studentNumber}번 학생이 없습니다. 번호를 다시 확인하고, 맞다면 담임 선생님께 명단에 빠져 있다고 알려주세요.`,
    "number_not_in_roster",
  );
}
function nameMismatch(studentNumber: number) {
  return badRequest(
    `${studentNumber}번 학생의 이름이 명단과 다릅니다. 담임 선생님이 등록한 이름 그대로 입력했는지 확인해주세요. (띄어쓰기는 상관없습니다)`,
    "name_mismatch",
  );
}

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

    const grade = (body.grade ?? "").trim();
    const classNumber = (body.classNumber ?? "").trim();
    if (!grade) throw badRequest("학년을 골라주세요.");
    if (!classNumber) throw badRequest("반을 골라주세요.");

    const db = adminDb();
    // 학교는 한 곳뿐이라 입력받지 않는다.
    const matchKey = buildClassMatchKey({ schoolYear, schoolName: SCHOOL_NAME, grade, classNumber });

    const classSnap = await db.collection(COL.classes).where("matchKey", "==", matchKey).get();
    if (classSnap.size !== 1) throw classNotFound(schoolYear, grade, classNumber);
    const klass = classSnap.docs[0].data() as ClassDoc;

    // 번호로 좁힌 뒤 정규화된 이름을 정확히 비교한다. 유사도 매칭은 하지 않는다.
    const rosterSnap = await db
      .collection(COL.roster)
      .where("classId", "==", klass.classId)
      .where("studentNumber", "==", studentNumber)
      .get();

    if (rosterSnap.empty) throw numberNotInRoster(grade, classNumber, studentNumber);

    const nameNorm = normalizeStudentName(studentName);
    const matches = rosterSnap.docs.filter(
      (d) => (d.data() as RosterDoc).studentNameNorm === nameNorm,
    );
    if (matches.length !== 1) throw nameMismatch(studentNumber);

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
