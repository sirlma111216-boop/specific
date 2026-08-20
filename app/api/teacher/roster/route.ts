import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { parseStudentRows } from "@/lib/roster/parse-students";
import type { RosterDoc } from "@/lib/types";

interface AddBody {
  students?: Array<{ studentNumber?: unknown; studentName?: unknown }>;
}

/** 학급 생성 이후 학생을 추가한다. (전학생, 명단 누락 등) */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const body = await readJson<AddBody>(req);

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
    const existingSnap = await db.collection(COL.roster).where("classId", "==", ctx.classId).get();
    const existingNumbers = new Set(
      existingSnap.docs.map((d) => (d.data() as RosterDoc).studentNumber),
    );

    const conflicts = parsed.students.filter((s) => existingNumbers.has(s.studentNumber));
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
      const roster: RosterDoc = {
        rosterId: ref.id,
        classId: ctx.classId,
        studentNumber: s.studentNumber,
        studentName: s.studentName,
        studentNameNorm: s.studentNameNorm,
        signupStatus: "pending",
        linkedUserId: null,
        createdAt: now,
      };
      batch.set(ref, roster);
    }
    await batch.commit();

    return { added: parsed.students.length };
  });
}

/** 아직 가입하지 않은 학생만 명단에서 뺄 수 있다. */
export async function DELETE(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const rosterId = new URL(req.url).searchParams.get("rosterId") ?? "";
    if (!rosterId) throw badRequest("삭제할 학생을 지정해주세요.");

    const db = adminDb();
    const ref = db.collection(COL.roster).doc(rosterId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("학생을 찾을 수 없습니다.");

    const roster = snap.data() as RosterDoc;
    if (roster.classId !== ctx.classId) throw notFound("학생을 찾을 수 없습니다.");
    if (roster.signupStatus === "linked") {
      throw badRequest("이미 가입한 학생은 명단에서 삭제할 수 없습니다.", "already_linked");
    }

    await ref.delete();
    return { ok: true };
  });
}
