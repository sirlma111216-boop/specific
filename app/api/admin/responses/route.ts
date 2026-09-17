import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL, noteId, responseId } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { materialDelta, rosterCountField } from "@/lib/events/counters";
import { MAX_ANSWER_LENGTH } from "@/lib/forms/schema";
import { countCharacters } from "@/lib/utils";
import type { EventDoc, ResponseDoc, RosterDoc } from "@/lib/types";

interface Body {
  rosterId?: string;
  eventId?: string;
  content?: string;
}

/**
 * 슈퍼관리자가 학생 원문을 대신 만든다. 활동이 마감됐든 날짜가 지났든 상관없다.
 * 학생 계정이 연결되어 있어야 한다 — 원문 문서는 계정(uid) 기준으로 저장되기 때문이다.
 * 계정이 없는 학생은 교사 보완본으로 기록을 남긴다.
 */
export async function POST(req: Request) {
  return route(async () => {
    await requireAdmin(req);
    const body = await readJson<Body>(req);
    const rosterId = (body.rosterId ?? "").trim();
    const eventId = (body.eventId ?? "").trim();
    const content = (body.content ?? "").trim();
    if (!rosterId || !eventId) throw badRequest("학생과 활동을 지정해주세요.");
    if (!content) throw badRequest("내용을 입력해주세요.");
    if (countCharacters(content) > MAX_ANSWER_LENGTH) {
      throw badRequest(`${MAX_ANSWER_LENGTH}자 이내로 작성해주세요.`);
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
    if (!roster.linkedUserId) {
      throw badRequest("아직 가입하지 않은 학생입니다. 학생 원문 대신 교사 보완본으로 기록해주세요.", "not_linked");
    }

    const ref = db.collection(COL.responses).doc(responseId(eventId, roster.linkedUserId));
    const [existing, noteSnap] = await Promise.all([
      ref.get(),
      db.collection(COL.notes).doc(noteId(eventId, rosterId)).get(),
    ]);
    if (existing.exists && (existing.data() as ResponseDoc).content?.trim()) {
      throw badRequest("이미 학생 원문이 있습니다. 수정 기능을 쓰세요.");
    }
    const hasNote = Boolean((noteSnap.data() as { content?: string } | undefined)?.content?.trim());

    const now = Date.now();
    const doc: ResponseDoc = {
      responseId: ref.id,
      eventId,
      classId: roster.classId,
      studentUid: roster.linkedUserId,
      rosterId,
      content,
      createdAt: now,
      updatedAt: now,
    };
    const batch = db.batch();
    batch.set(ref, doc);
    batch.update(db.collection(COL.events).doc(eventId), { submittedCount: FieldValue.increment(1) });
    const delta = materialDelta(hasNote, true);
    if (delta !== 0) {
      batch.update(rosterSnap.ref, { [rosterCountField(event.category)]: FieldValue.increment(delta) });
    }
    await batch.commit();
    return { ok: true, responseId: ref.id };
  });
}
