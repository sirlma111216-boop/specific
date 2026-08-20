import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL, noteId, responseId } from "@/lib/firebase/admin";
import { badRequest, forbidden, notFound } from "@/lib/api-error";
import { requireStudent } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { MAX_REFLECTION_LENGTH } from "@/lib/events/defaults";
import { canWriteNow, isPastDue } from "@/lib/events/phase";
import { materialDelta, rosterCountField } from "@/lib/events/counters";
import { countCharacters, todayInKST } from "@/lib/utils";
import type { EventDoc, ResponseDoc } from "@/lib/types";

interface Body {
  eventId?: string;
  content?: string;
}

/** 학생 소감 저장. 작성 가능한 상태의 활동에만 쓸 수 있다. */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireStudent(req);
    const body = await readJson<Body>(req);
    const eventId = (body.eventId ?? "").trim();
    const content = (body.content ?? "").trim();

    if (!eventId) throw badRequest("활동을 찾을 수 없습니다.");
    if (!content) throw badRequest("내용을 입력해주세요.");
    if (countCharacters(content) > MAX_REFLECTION_LENGTH) {
      throw badRequest(`내용이 너무 깁니다. ${MAX_REFLECTION_LENGTH}자 이내로 작성해주세요.`);
    }

    const db = adminDb();
    const eventSnap = await db.collection(COL.events).doc(eventId).get();
    if (!eventSnap.exists) throw notFound("활동을 찾을 수 없습니다.");
    const event = eventSnap.data() as EventDoc;

    // 다른 학급의 활동에는 쓸 수 없다.
    if (event.classId !== ctx.classId) throw notFound("활동을 찾을 수 없습니다.");

    const today = todayInKST();

    // 이미 작성했는지와 무관하게 "지금 쓸 수 있는 활동인가"만 본다.
    // 그래야 당일에 쓴 학생도 날짜가 지나면 수정하지 못하고 조회만 하게 된다.
    if (!canWriteNow(event.status, event.eventDate, today)) {
      if (event.status === "scheduled" && event.eventDate > today) {
        throw forbidden("아직 작성할 수 없는 활동입니다.");
      }
      throw forbidden(
        isPastDue(event.status, event.eventDate, today)
          ? "작성 기간이 지났습니다. 활동 당일에만 작성할 수 있습니다. 담임 선생님께 문의해주세요."
          : "마감된 활동입니다. 담임 선생님께 문의해주세요.",
      );
    }

    const docId = responseId(eventId, ctx.uid);
    const ref = db.collection(COL.responses).doc(docId);

    // 카운터를 정확히 올리려면 "이미 이 활동에 자료가 있었는지"를 알아야 한다.
    // 학생 원문과 교사 보완본 둘 다 확인한다. (문서 2건 읽기)
    const [existing, noteSnap] = await Promise.all([
      ref.get(),
      db.collection(COL.notes).doc(noteId(eventId, ctx.rosterId)).get(),
    ]);
    const prev = existing.data() as ResponseDoc | undefined;
    const hadResponse = Boolean(prev?.content?.trim());
    const hasNote = Boolean((noteSnap.data() as { content?: string } | undefined)?.content?.trim());

    const now = Date.now();
    const doc: ResponseDoc = {
      responseId: docId,
      eventId,
      classId: ctx.classId,
      studentUid: ctx.uid,
      rosterId: ctx.rosterId,
      content,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(ref, doc);

    const delta = materialDelta(hadResponse || hasNote, true);
    if (delta !== 0) {
      batch.update(db.collection(COL.roster).doc(ctx.rosterId), {
        [rosterCountField(event.category)]: FieldValue.increment(delta),
      });
    }
    // 활동별 제출 인원은 학생 원문 기준으로만 센다.
    if (!hadResponse) {
      batch.update(db.collection(COL.events).doc(eventId), {
        submittedCount: FieldValue.increment(1),
      });
    }
    await batch.commit();

    return { ok: true, updatedAt: now };
  });
}
