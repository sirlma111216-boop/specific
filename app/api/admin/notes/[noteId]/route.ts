import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL, responseId } from "@/lib/firebase/admin";
import { notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { materialDelta, rosterCountField } from "@/lib/events/counters";
import type { EventDoc, ResponseDoc, RosterDoc, TeacherNoteDoc } from "@/lib/types";

/** 교사 보완본 삭제. 학생 원문이 없으면 그 활동의 기록 수도 내린다. */
export async function DELETE(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { noteId } = await params;
    const db = adminDb();

    const ref = db.collection(COL.notes).doc(noteId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("교사 기록을 찾을 수 없습니다.");
    const n = snap.data() as TeacherNoteDoc;

    const [eventSnap, rosterSnap] = await Promise.all([
      db.collection(COL.events).doc(n.eventId).get(),
      db.collection(COL.roster).doc(n.rosterId).get(),
    ]);
    const event = eventSnap.exists ? (eventSnap.data() as EventDoc) : null;
    const roster = rosterSnap.exists ? (rosterSnap.data() as RosterDoc) : null;

    // 학생 원문이 있는지 봐야 카운터를 내릴지 정할 수 있다.
    let hasResponse = false;
    if (roster?.linkedUserId) {
      const r = await db.collection(COL.responses).doc(responseId(n.eventId, roster.linkedUserId)).get();
      hasResponse = Boolean((r.data() as ResponseDoc | undefined)?.content?.trim());
    }

    const batch = db.batch();
    batch.delete(ref);
    if (event) {
      const delta = materialDelta(Boolean(n.content?.trim()) || hasResponse, hasResponse);
      if (delta !== 0) {
        batch.update(db.collection(COL.roster).doc(n.rosterId), {
          [rosterCountField(event.category)]: FieldValue.increment(delta),
        });
      }
    }
    await batch.commit();
    return { ok: true };
  });
}
