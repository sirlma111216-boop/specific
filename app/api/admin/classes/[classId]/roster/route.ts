import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { parseStudentRows } from "@/lib/roster/parse-students";
import type { ClassDoc, RosterDoc } from "@/lib/types";

interface Body {
  students?: Array<{ studentNumber?: unknown; studentName?: unknown }>;
}

/** 관리자가 학급 명단에 학생을 추가한다. 교사 화면의 추가와 같은 규칙을 쓴다. */
export async function POST(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { classId } = await params;
    const body = await readJson<Body>(req);
    const db = adminDb();

    const classSnap = await db.collection(COL.classes).doc(classId).get();
    if (!classSnap.exists) throw notFound("학급을 찾을 수 없습니다.");
    const klass = classSnap.data() as ClassDoc;

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
    if (parsed.students.length === 0) throw badRequest("추가할 학생을 입력해주세요.");

    const existing = await db.collection(COL.roster).where("classId", "==", classId).get();
    const numbers = new Set(existing.docs.map((d) => (d.data() as RosterDoc).studentNumber));
    const conflicts = parsed.students.filter((s) => numbers.has(s.studentNumber));
    if (conflicts.length > 0) {
      throw badRequest(
        `이미 등록된 번호가 있습니다: ${conflicts.map((c) => `${c.studentNumber}번`).join(", ")}`,
        "number_conflict",
      );
    }

    const batch = db.batch();
    const now = Date.now();
    for (const s of parsed.students) {
      const ref = db.collection(COL.roster).doc();
      const doc: RosterDoc = {
        rosterId: ref.id,
        classId,
        studentNumber: s.studentNumber,
        studentName: s.studentName,
        studentNameNorm: s.studentNameNorm,
        signupStatus: "pending",
        linkedUserId: null,
        createdAt: now,
        autonomousCount: 0,
        careerCount: 0,
      };
      batch.set(ref, doc);
    }
    batch.update(classSnap.ref, { studentCount: FieldValue.increment(parsed.students.length) });
    await batch.commit();

    return { added: parsed.students.length, klass: { classId: klass.classId } };
  });
}
