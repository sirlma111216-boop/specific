import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { deleteRosterEntry } from "@/lib/admin/cascade";
import { normalizeStudentName } from "@/lib/roster/normalize";
import type { RosterDoc } from "@/lib/types";

interface PatchBody {
  studentNumber?: number | string;
  studentName?: string;
}

/** 명단 행의 번호·이름 수정. 이름을 바꾸면 가입 대조용 정규화 값도 함께 바꾼다. */
export async function PATCH(req: Request, { params }: { params: Promise<{ rosterId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { rosterId } = await params;
    const body = await readJson<PatchBody>(req);
    const db = adminDb();

    const ref = db.collection(COL.roster).doc(rosterId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const roster = snap.data() as RosterDoc;

    const next: Partial<RosterDoc> = {};
    if (body.studentNumber !== undefined) {
      const n = Number(body.studentNumber);
      if (!Number.isInteger(n) || n <= 0) throw badRequest("번호를 올바르게 입력해주세요.");
      if (n !== roster.studentNumber) {
        const dup = await db
          .collection(COL.roster)
          .where("classId", "==", roster.classId)
          .where("studentNumber", "==", n)
          .limit(1)
          .get();
        if (!dup.empty) throw badRequest(`${n}번은 이미 있습니다.`, "number_conflict");
      }
      next.studentNumber = n;
    }
    if (body.studentName !== undefined) {
      const name = String(body.studentName).trim();
      if (!name) throw badRequest("이름을 입력해주세요.");
      next.studentName = name;
      next.studentNameNorm = normalizeStudentName(name);
    }

    await ref.update(next);
    return { roster: { ...roster, ...next } };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ rosterId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { rosterId } = await params;
    const snap = await adminDb().collection(COL.roster).doc(rosterId).get();
    if (!snap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const result = await deleteRosterEntry(rosterId);
    return { ok: true, ...result };
  });
}
