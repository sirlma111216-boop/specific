import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { loadAllClasses, loadAllRoster, loadAllUsers, sortClassSummaries, summarizeAccount, summarizeClass } from "@/lib/admin/lookup";
import { invalidateAdminCache } from "@/lib/server-cache";
import { formatClassFull } from "@/lib/utils";
import type { ClassDoc, Role, RosterDoc, UserDoc } from "@/lib/types";

/** 계정 목록. 학급·명단과 대조해 어긋난 계정에는 이유를 붙인다. */
export async function GET(req: Request) {
  return route(async () => {
    await requireAdmin(req);
    const [users, classes, roster] = await Promise.all([
      loadAllUsers(),
      loadAllClasses(),
      loadAllRoster(),
    ]);
    const label = (c: ClassDoc) => formatClassFull(c.schoolYear, c.grade, c.classNumber);
    const accounts = Array.from(users.entries())
      .map(([uid, u]) => summarizeAccount(uid, u, classes, roster, label))
      .sort((a, b) => {
        const order: Record<Role, number> = { admin: 0, scheduler: 1, teacher: 2, student: 3 };
        return (
          order[a.role] - order[b.role] ||
          Number(a.isTest) - Number(b.isTest) ||
          (a.classLabel ?? "").localeCompare(b.classLabel ?? "", "ko", { numeric: true }) ||
          (a.studentNumber ?? 0) - (b.studentNumber ?? 0) ||
          a.email.localeCompare(b.email)
        );
      });
    // 계정 화면의 학급 선택지. 따로 /api/admin/classes 를 부르면 같은 세 컬렉션을 한 번 더 읽는다.
    const rosterByClass = new Map<string, RosterDoc[]>();
    for (const r of roster.values()) {
      const list = rosterByClass.get(r.classId) ?? [];
      list.push(r);
      rosterByClass.set(r.classId, list);
    }
    const classSummaries = sortClassSummaries(
      Array.from(classes.values()).map((c) => summarizeClass(c, users, rosterByClass.get(c.classId) ?? [])),
    );
    return { accounts, classes: classSummaries };
  });
}

interface CreateBody {
  role?: "teacher" | "student" | "scheduler";
  email?: string;
  password?: string;
  teacherName?: string;
  classId?: string | null;
  rosterId?: string | null;
}

/**
 * 계정 생성.
 *  · 교사: 이메일·비밀번호·이름. 학급을 지정하면 그 학급의 담임으로 연결한다.
 *  · 학생: 이메일·비밀번호 + 아직 가입하지 않은 명단 행. 그 행에 연결된 채로 만들어진다.
 *  · 일정 관리자: 이메일·비밀번호. 활동만 다루는 계정이라 학급·명단과 무관하다.
 * 가입 코드나 명단 대조 없이 관리자가 직접 만드는 경로라, 연수용·긴급용이다.
 */
export async function POST(req: Request) {
  return route(async () => {
    await requireAdmin(req);
    const body = await readJson<CreateBody>(req);
    const db = adminDb();

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("이메일 형식이 올바르지 않습니다.");
    if (password.length < 6) throw badRequest("비밀번호는 6자 이상이어야 합니다.");
    if (body.role !== "teacher" && body.role !== "student" && body.role !== "scheduler") {
      throw badRequest("역할을 골라주세요.");
    }

    let klass: ClassDoc | null = null;
    let rosterRef: FirebaseFirestore.DocumentReference | null = null;
    let roster: RosterDoc | null = null;

    if (body.role === "scheduler") {
      // 학급·명단 확인이 필요 없다.
    } else if (body.role === "teacher") {
      if (!(body.teacherName ?? "").trim()) throw badRequest("교사 이름을 입력해주세요.");
      if (body.classId) {
        const snap = await db.collection(COL.classes).doc(body.classId).get();
        if (!snap.exists) throw notFound("학급을 찾을 수 없습니다.");
        klass = snap.data() as ClassDoc;
      }
    } else {
      if (!body.rosterId) throw badRequest("연결할 명단 행을 골라주세요.");
      rosterRef = db.collection(COL.roster).doc(body.rosterId);
      const snap = await rosterRef.get();
      if (!snap.exists) throw notFound("명단 행을 찾을 수 없습니다.");
      roster = snap.data() as RosterDoc;
      if (roster.signupStatus === "linked" && roster.linkedUserId) {
        throw badRequest("이미 계정이 연결된 학생입니다. 먼저 기존 계정을 지우거나 연결을 푸세요.");
      }
      const classSnap = await db.collection(COL.classes).doc(roster.classId).get();
      klass = classSnap.exists ? (classSnap.data() as ClassDoc) : null;
    }

    let uid: string;
    try {
      uid = (await adminAuth().createUser({ email, password })).uid;
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-exists") throw badRequest("이미 가입된 이메일입니다.");
      if (code === "auth/invalid-email") throw badRequest("이메일 형식이 올바르지 않습니다.");
      throw err;
    }

    try {
      await adminAuth().setCustomUserClaims(uid, { role: body.role });
      const now = Date.now();
      const isTest = Boolean(klass?.isTest);
      if (body.role === "scheduler") {
        const doc: UserDoc = { uid, role: "scheduler", email, createdAt: now, classId: null };
        await db.collection(COL.users).doc(uid).set(doc);
      } else if (body.role === "teacher") {
        const doc: UserDoc = {
          uid,
          role: "teacher",
          email,
          createdAt: now,
          classId: klass?.classId ?? null,
          teacherName: (body.teacherName ?? "").trim(),
          ...(isTest ? { isTest: true } : {}),
        };
        const batch = db.batch();
        batch.set(db.collection(COL.users).doc(uid), doc);
        if (klass) batch.update(db.collection(COL.classes).doc(klass.classId), { teacherId: uid });
        await batch.commit();
      } else {
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(rosterRef!);
          const data = fresh.data() as RosterDoc;
          if (data.signupStatus === "linked" && data.linkedUserId) {
            throw badRequest("이미 계정이 연결된 학생입니다.");
          }
          tx.update(rosterRef!, { signupStatus: "linked", linkedUserId: uid });
          const doc: UserDoc = {
            uid,
            role: "student",
            email,
            createdAt: now,
            classId: data.classId,
            rosterId: data.rosterId,
            ...(isTest ? { isTest: true } : {}),
          };
          tx.set(db.collection(COL.users).doc(uid), doc);
        });
      }
    } catch (err) {
      await adminAuth().deleteUser(uid).catch(() => {});
      throw err;
    }

    invalidateAdminCache();
    return { ok: true, uid };
  });
}
