import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { commitInChunks } from "@/lib/firebase/batch";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { parseStudentRows } from "@/lib/roster/parse-students";
import type { ResponseDoc, RosterDoc, UserDoc } from "@/lib/types";

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
        autonomousCount: 0,
        careerCount: 0,
      };
      batch.set(ref, roster);
    }
    // 목록 화면이 명단 문서를 세지 않아도 되도록 학급 문서에 인원수를 유지한다.
    batch.update(db.collection(COL.classes).doc(ctx.classId), {
      studentCount: FieldValue.increment(parsed.students.length),
    });
    await batch.commit();

    return { added: parsed.students.length };
  });
}

/**
 * 학생을 명단에서 뺀다. 전학 등으로 가입한 학생도 뺄 수 있다.
 *
 * 명단만 지우면 계정이 남아 학생이 계속 소감을 낼 수 있고, 활동별 제출 인원도 어긋난다.
 * 그래서 그 학생에게 딸린 자료를 함께 정리한다. 되돌릴 수 없다.
 */
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

    const [responses, notes, records] = await Promise.all([
      db.collection(COL.responses).where("rosterId", "==", rosterId).get(),
      db.collection(COL.notes).where("rosterId", "==", rosterId).get(),
      db.collection(COL.records).where("rosterId", "==", rosterId).get(),
    ]);

    const ops: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    responses.forEach((d) => {
      const r = d.data() as ResponseDoc;
      ops.push((b) => b.delete(d.ref));
      // 활동별 제출 인원에서도 빼야 관리자 화면의 "N/25명 작성"이 맞는다.
      if (r.content?.trim()) {
        ops.push((b) =>
          b.update(db.collection(COL.events).doc(r.eventId), {
            submittedCount: FieldValue.increment(-1),
          }),
        );
      }
    });
    notes.forEach((d) => ops.push((b) => b.delete(d.ref)));
    records.forEach((d) => ops.push((b) => b.delete(d.ref)));
    ops.push((b) => b.delete(ref));
    ops.push((b) =>
      b.update(db.collection(COL.classes).doc(ctx.classId), {
        studentCount: FieldValue.increment(-1),
      }),
    );

    await commitInChunks(ops);

    // 계정이 연결돼 있었다면 함께 지운다. 남겨두면 명단 없는 계정으로 로그인해
    // 활동에 계속 답할 수 있다.
    let removedAccount = false;
    if (roster.linkedUserId) {
      const userRef = db.collection(COL.users).doc(roster.linkedUserId);
      const userSnap = await userRef.get();
      // 다른 학생의 계정을 잘못 지우지 않도록 연결 관계를 한 번 더 확인한다.
      if (userSnap.exists && (userSnap.data() as UserDoc).rosterId === rosterId) {
        await userRef.delete();
        await adminAuth().deleteUser(roster.linkedUserId).catch(() => {});
        removedAccount = true;
      }
    }

    return {
      ok: true,
      removedAccount,
      deletedResponses: responses.size,
      deletedNotes: notes.size,
      deletedRecords: records.size,
    };
  });
}
