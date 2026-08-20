import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacher } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { buildClassMatchKey } from "@/lib/roster/normalize";
import { parseStudentRows } from "@/lib/roster/parse-students";
import type { ClassDoc, RosterDoc } from "@/lib/types";

interface CreateBody {
  schoolYear?: string | number;
  schoolName?: string;
  grade?: string;
  classNumber?: string;
  teacherName?: string;
  students?: Array<{ studentNumber?: unknown; studentName?: unknown }>;
}

export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireTeacher(req);
    if (!ctx.classId) return { klass: null };
    const snap = await adminDb().collection(COL.classes).doc(ctx.classId).get();
    if (!snap.exists) throw notFound("학급 정보를 찾을 수 없습니다.");
    return { klass: snap.data() as ClassDoc };
  });
}

/** 교사 최초 온보딩: 학급 + 학생 사전 명단을 한 번에 만든다. */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacher(req);
    if (ctx.classId) {
      throw badRequest("이미 학급이 등록되어 있습니다.", "class_exists");
    }

    const body = await readJson<CreateBody>(req);
    const schoolYear = Number(body.schoolYear);
    const schoolName = (body.schoolName ?? "").trim();
    const grade = (body.grade ?? "").trim();
    const classNumber = (body.classNumber ?? "").trim();
    const teacherName = (body.teacherName ?? "").trim();

    if (!Number.isInteger(schoolYear) || schoolYear < 2000 || schoolYear > 2100) {
      throw badRequest("학년도를 올바르게 입력해주세요. (예: 2026)");
    }
    if (!schoolName) throw badRequest("학교명을 입력해주세요.");
    if (!grade) throw badRequest("학년을 입력해주세요.");
    if (!classNumber) throw badRequest("반을 입력해주세요.");
    if (!teacherName) throw badRequest("담임교사 이름을 입력해주세요.");

    const parsed = parseStudentRows(
      (body.students ?? []).map((s, i) => ({
        studentNumber: s.studentNumber,
        studentName: s.studentName,
        sourceRow: i + 1,
      })),
    );
    if (parsed.errors.length > 0) {
      throw badRequest(`학생 명단에 문제가 있습니다.\n${parsed.errors.join("\n")}`, "roster_invalid");
    }

    const db = adminDb();
    const matchKey = buildClassMatchKey({ schoolYear, schoolName, grade, classNumber });

    // 같은 학급이 두 번 등록되면 학생 가입 시 학급을 특정할 수 없게 된다.
    const dup = await db.collection(COL.classes).where("matchKey", "==", matchKey).limit(1).get();
    if (!dup.empty) {
      throw badRequest(
        "같은 학년도·학교·학년·반이 이미 등록되어 있습니다. 학급 정보를 확인해주세요.",
        "class_duplicated",
      );
    }

    const classRef = db.collection(COL.classes).doc();
    const now = Date.now();
    const klass: ClassDoc = {
      classId: classRef.id,
      schoolYear,
      schoolName,
      grade,
      classNumber,
      teacherName,
      teacherId: ctx.uid,
      createdAt: now,
      matchKey,
      studentCount: parsed.students.length,
    };

    const batch = db.batch();
    batch.set(classRef, klass);
    for (const s of parsed.students) {
      const rosterRef = db.collection(COL.roster).doc();
      const roster: RosterDoc = {
        rosterId: rosterRef.id,
        classId: classRef.id,
        studentNumber: s.studentNumber,
        studentName: s.studentName,
        studentNameNorm: s.studentNameNorm,
        signupStatus: "pending",
        linkedUserId: null,
        createdAt: now,
        autonomousCount: 0,
        careerCount: 0,
      };
      batch.set(rosterRef, roster);
    }
    batch.update(db.collection(COL.users).doc(ctx.uid), {
      classId: classRef.id,
      teacherName,
    });
    await batch.commit();

    return { classId: classRef.id, studentCount: parsed.students.length };
  });
}
