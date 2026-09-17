import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL, noteId } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { materialDelta, rosterCountField } from "@/lib/events/counters";
import { MAX_REFLECTION_LENGTH } from "@/lib/events/defaults";
import { countCharacters } from "@/lib/utils";
import type { EventDoc, RosterDoc, TeacherNoteDoc } from "@/lib/types";

interface Body {
  rosterId?: string;
  eventId?: string;
  content?: string;
}

/**
 * 슈퍼관리자가 교사 보완본을 만들거나 고친다. 담임 화면과 같은 규칙으로 카운터를 맞춘다.
 * 활동 마감·날짜와 무관하고, 학생 계정이 없어도 된다.
 */
export async function PUT(req: Request) {
  return route(async () => {
    const ctx = await requireAdmin(req);
    const body = await readJson<Body>(req);
    const rosterId = (body.rosterId ?? "").trim();
    const eventId = (body.eventId ?? "").trim();
    const content = (body.content ?? "").trim();
    if (!rosterId || !eventId) throw badRequest("학생과 활동을 지정해주세요.");
    if (!content) throw badRequest("내용을 입력해주세요. 비우려면 삭제를 쓰세요.");
    if (countCharacters(content) > MAX_REFLECTION_LENGTH) {
      throw badRequest(`내용이 너무 깁니다. ${MAX_REFLECTION_LENGTH}자 이내로 작성해주세요.`);
    }

    const db = adminDb();
    const [rosterSnap, eventSnap] = await Promise.all([
      db.collection(COL.roster).doc(rosterId).get(),
      db.collection(COL.events).doc(eventId).get(),
    ]);
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    if (!eventSnap.exists) throw notFound("활동을 찾을 수 없습니다.");
    const roster = rosterSnap.data() as RosterDoc;
    const event = eventSnap.data() as EventDoc;

    const ref = db.collection(COL.notes).doc(noteId(eventId, rosterId));
    const [existing, responseSnap] = await Promise.all([
      ref.get(),
      db.collection(COL.responses).where("rosterId", "==", rosterId).where("eventId", "==", eventId).limit(1).get(),
    ]);
    const prev = existing.data() as TeacherNoteDoc | undefined;
    const hadNote = Boolean(prev?.content?.trim());
    const hasResponse = responseSnap.docs.some((d) => Boolean((d.data() as { content?: string }).content?.trim()));

    const now = Date.now();
    const doc: TeacherNoteDoc = {
      noteId: ref.id,
      classId: roster.classId,
      rosterId,
      eventId,
      teacherId: prev?.teacherId ?? ctx.uid,
      content,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    const batch = db.batch();
    batch.set(ref, doc);
    const delta = materialDelta(hadNote || hasResponse, true);
    if (delta !== 0) {
      batch.update(rosterSnap.ref, { [rosterCountField(event.category)]: FieldValue.increment(delta) });
    }
    await batch.commit();
    return { ok: true, note: doc };
  });
}
