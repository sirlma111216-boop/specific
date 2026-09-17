import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { deleteClass } from "@/lib/admin/cascade";
import { buildClassMatchKey } from "@/lib/roster/normalize";
import { SCHOOL_NAME } from "@/lib/school";
import type { ClassDoc, RosterDoc, UserDoc } from "@/lib/types";

interface PatchBody {
  schoolYear?: number | string;
  grade?: string;
  classNumber?: string;
  teacherName?: string;
  isTest?: boolean;
}

async function loadClass(classId: string) {
  const ref = adminDb().collection(COL.classes).doc(classId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("학급을 찾을 수 없습니다.");
  return { ref, klass: snap.data() as ClassDoc };
}

/** 학급 상세: 학급 정보 + 담임 계정 + 명단(가입 계정 이메일 포함) */
export async function GET(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { classId } = await params;
    const { klass } = await loadClass(classId);
    const db = adminDb();

    const [rosterSnap, teacherSnap] = await Promise.all([
      db.collection(COL.roster).where("classId", "==", classId).get(),
      klass.teacherId ? db.collection(COL.users).doc(klass.teacherId).get() : null,
    ]);
    const teacher = teacherSnap?.exists ? (teacherSnap.data() as UserDoc) : null;

    // 가입한 학생의 이메일을 함께 보여준다. 연결된 계정만 골라 한 번에 읽는다.
    const linkedIds = rosterSnap.docs
      .map((d) => (d.data() as RosterDoc).linkedUserId)
      .filter((id): id is string => Boolean(id));
    const emailByUid = new Map<string, string>();
    if (linkedIds.length > 0) {
      const refs = linkedIds.map((id) => db.collection(COL.users).doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s) => {
        if (s.exists) emailByUid.set(s.id, (s.data() as UserDoc).email);
      });
    }

    const roster = rosterSnap.docs
      .map((d) => d.data() as RosterDoc)
      .sort((a, b) => a.studentNumber - b.studentNumber)
      .map((r) => ({
        rosterId: r.rosterId,
        studentNumber: r.studentNumber,
        studentName: r.studentName,
        signupStatus: r.signupStatus,
        linkedUserId: r.linkedUserId,
        email: r.linkedUserId ? (emailByUid.get(r.linkedUserId) ?? null) : null,
        autonomousCount: r.autonomousCount ?? 0,
        careerCount: r.careerCount ?? 0,
      }));

    return {
      klass,
      teacher: teacher
        ? {
            uid: klass.teacherId,
            email: teacher.email,
            teacherName: teacher.teacherName ?? "",
            classId: teacher.classId,
          }
        : null,
      roster,
    };
  });
}

/** 학급 기본 정보 수정. 학년·반을 바꾸면 대조 키도 다시 만든다. */
export async function PATCH(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { classId } = await params;
    const { ref, klass } = await loadClass(classId);
    const body = await readJson<PatchBody>(req);
    const db = adminDb();

    const next: Partial<ClassDoc> = {};
    if (body.schoolYear !== undefined) {
      const y = Number(body.schoolYear);
      if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        throw badRequest("학년도를 올바르게 입력해주세요.");
      }
      next.schoolYear = y;
    }
    if (body.grade !== undefined) {
      const g = String(body.grade).trim();
      if (!g) throw badRequest("학년을 입력해주세요.");
      next.grade = g;
    }
    if (body.classNumber !== undefined) {
      const c = String(body.classNumber).trim();
      if (!c) throw badRequest("반을 입력해주세요.");
      next.classNumber = c;
    }
    if (body.teacherName !== undefined) {
      const t = String(body.teacherName).trim();
      if (!t) throw badRequest("담임교사 이름을 입력해주세요.");
      next.teacherName = t;
    }
    if (body.isTest !== undefined) next.isTest = Boolean(body.isTest);

    const merged = { ...klass, ...next };
    const matchKey = buildClassMatchKey({
      schoolYear: merged.schoolYear,
      schoolName: SCHOOL_NAME,
      grade: merged.grade,
      classNumber: merged.classNumber,
    });
    if (matchKey !== klass.matchKey) {
      const dup = await db.collection(COL.classes).where("matchKey", "==", matchKey).limit(1).get();
      if (!dup.empty && dup.docs[0].id !== classId) {
        throw badRequest("같은 학년도·학년·반이 이미 있습니다.", "class_duplicated");
      }
      next.matchKey = matchKey;
      next.schoolName = SCHOOL_NAME;
    }

    await ref.update(next);

    // 테스트 여부가 바뀌면 이 학급 계정들의 표시도 맞춘다. (활동 노출 범위가 여기서 갈린다)
    if (body.isTest !== undefined && Boolean(body.isTest) !== Boolean(klass.isTest)) {
      const members = await db.collection(COL.users).where("classId", "==", classId).get();
      const batch = db.batch();
      members.forEach((d) => batch.update(d.ref, { isTest: Boolean(body.isTest) }));
      await batch.commit();
    }

    return { klass: { ...klass, ...next } };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { classId } = await params;
    await loadClass(classId);
    const result = await deleteClass(classId);
    return { ok: true, ...result };
  });
}
