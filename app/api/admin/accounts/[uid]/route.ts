import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, forbidden, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { deleteAccount } from "@/lib/admin/cascade";
import type { ClassDoc, RosterDoc, UserDoc } from "@/lib/types";

interface PatchBody {
  /** 새 비밀번호 (6자 이상) */
  password?: string;
  email?: string;
  teacherName?: string;
  /** 교사: 담임을 맡을 학급. null 이면 연결을 푼다 */
  classId?: string | null;
  /** 학생: 연결할 명단 행. 아직 가입하지 않은 행이어야 한다 */
  rosterId?: string;
}

async function loadUser(uid: string) {
  const ref = adminDb().collection(COL.users).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("계정을 찾을 수 없습니다.");
  return { ref, user: snap.data() as UserDoc };
}

/**
 * 계정 수정. 비밀번호 재설정, 이메일 변경, 교사의 학급 배정, 학생의 명단 재연결.
 * 관리자 계정 자체는 여기서 손대지 않는다. (환경변수로 지정된 하나뿐이다)
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { uid } = await params;
    const { ref, user } = await loadUser(uid);
    if (user.role === "admin") throw forbidden("관리자 계정은 여기서 수정할 수 없습니다.");
    const body = await readJson<PatchBody>(req);
    const db = adminDb();

    const authUpdate: { password?: string; email?: string } = {};
    const docUpdate: Partial<UserDoc> = {};
    const notes: string[] = [];

    if (body.password !== undefined) {
      if (body.password.length < 6) throw badRequest("비밀번호는 6자 이상이어야 합니다.");
      authUpdate.password = body.password;
      notes.push("비밀번호를 바꿨습니다.");
    }
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("이메일 형식이 올바르지 않습니다.");
      authUpdate.email = email;
      docUpdate.email = email;
      notes.push("이메일을 바꿨습니다.");
    }
    if (body.teacherName !== undefined && user.role === "teacher") {
      const name = body.teacherName.trim();
      if (!name) throw badRequest("교사 이름을 입력해주세요.");
      docUpdate.teacherName = name;
    }

    // 교사 ↔ 학급 배정
    if (body.classId !== undefined && user.role === "teacher") {
      if (body.classId === null) {
        docUpdate.classId = null;
        docUpdate.isTest = false;
        notes.push("학급 연결을 풀었습니다.");
      } else {
        const snap = await db.collection(COL.classes).doc(body.classId).get();
        if (!snap.exists) throw notFound("학급을 찾을 수 없습니다.");
        const klass = snap.data() as ClassDoc;
        docUpdate.classId = klass.classId;
        docUpdate.isTest = Boolean(klass.isTest);
        await snap.ref.update({ teacherId: uid, teacherName: docUpdate.teacherName ?? user.teacherName ?? klass.teacherName });
        notes.push("학급 담임으로 연결했습니다.");
      }
    }

    // 학생 ↔ 명단 재연결
    if (body.rosterId !== undefined && user.role === "student") {
      const nextRef = db.collection(COL.roster).doc(body.rosterId);
      const nextSnap = await nextRef.get();
      if (!nextSnap.exists) throw notFound("명단 행을 찾을 수 없습니다.");
      const next = nextSnap.data() as RosterDoc;
      if (next.linkedUserId && next.linkedUserId !== uid) {
        throw badRequest("그 명단 행에는 이미 다른 계정이 연결되어 있습니다.");
      }
      const classSnap = await db.collection(COL.classes).doc(next.classId).get();
      const klass = classSnap.exists ? (classSnap.data() as ClassDoc) : null;

      const batch = db.batch();
      if (user.rosterId && user.rosterId !== next.rosterId) {
        const prevRef = db.collection(COL.roster).doc(user.rosterId);
        const prev = await prevRef.get();
        if (prev.exists && (prev.data() as RosterDoc).linkedUserId === uid) {
          batch.update(prevRef, { signupStatus: "pending", linkedUserId: null });
        }
      }
      batch.update(nextRef, { signupStatus: "linked", linkedUserId: uid });
      await batch.commit();
      docUpdate.rosterId = next.rosterId;
      docUpdate.classId = next.classId;
      docUpdate.isTest = Boolean(klass?.isTest);
      notes.push(`${next.studentNumber}번 ${next.studentName} 명단에 연결했습니다.`);
    }

    if (Object.keys(authUpdate).length > 0) {
      try {
        await adminAuth().updateUser(uid, authUpdate);
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        if (code === "auth/email-already-exists") throw badRequest("이미 쓰고 있는 이메일입니다.");
        throw err;
      }
    }
    if (Object.keys(docUpdate).length > 0) await ref.update(docUpdate);

    return { ok: true, notes };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  return route(async () => {
    const ctx = await requireAdmin(req);
    const { uid } = await params;
    if (uid === ctx.uid) throw forbidden("자기 자신은 지울 수 없습니다.");
    const { user } = await loadUser(uid);
    if (user.role === "admin") throw forbidden("관리자 계정은 지울 수 없습니다.");
    const result = await deleteAccount(uid);
    return { ok: true, ...result };
  });
}
