import { adminDb, COL, noteId } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { MAX_REFLECTION_LENGTH } from "@/lib/events/defaults";
import { countCharacters } from "@/lib/utils";
import type { EventDoc, RosterDoc, TeacherNoteDoc } from "@/lib/types";

interface Body {
  rosterId?: string;
  eventId?: string;
  content?: string;
}

/**
 * 교사가 학생의 활동 기록을 보완한다.
 * - 학생이 쓴 원문(responses)은 건드리지 않는다. 별도 문서에 교사 보완본을 저장한다.
 * - 내용을 비우고 저장하면 보완본을 지워 학생 원문 상태로 되돌린다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const body = await readJson<Body>(req);
    const rosterId = (body.rosterId ?? "").trim();
    const eventId = (body.eventId ?? "").trim();
    const content = (body.content ?? "").trim();

    if (!rosterId) throw badRequest("학생을 선택해주세요.");
    if (!eventId) throw badRequest("활동을 선택해주세요.");
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
    if (roster.classId !== ctx.classId) throw notFound("학생을 찾을 수 없습니다.");
    if (event.classId !== ctx.classId) throw notFound("활동을 찾을 수 없습니다.");

    const id = noteId(eventId, rosterId);
    const ref = db.collection(COL.notes).doc(id);

    if (content === "") {
      await ref.delete().catch(() => {});
      return { ok: true, removed: true };
    }

    const existing = await ref.get();
    const now = Date.now();
    const doc: TeacherNoteDoc = {
      noteId: id,
      classId: ctx.classId,
      rosterId,
      eventId,
      teacherId: ctx.uid,
      content,
      createdAt: (existing.data() as TeacherNoteDoc | undefined)?.createdAt ?? now,
      updatedAt: now,
    };
    await ref.set(doc);

    return { ok: true, note: doc };
  });
}
