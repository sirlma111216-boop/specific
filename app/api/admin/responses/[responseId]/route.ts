import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL, noteId } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { materialDelta, rosterCountField } from "@/lib/events/counters";
import { MAX_ANSWER_LENGTH } from "@/lib/forms/schema";
import { countCharacters } from "@/lib/utils";
import type { EventDoc, ResponseDoc } from "@/lib/types";

interface PatchBody {
  content?: string;
}

async function load(responseId: string) {
  const db = adminDb();
  const ref = db.collection(COL.responses).doc(responseId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("응답을 찾을 수 없습니다.");
  const r = snap.data() as ResponseDoc;
  const eventSnap = await db.collection(COL.events).doc(r.eventId).get();
  const event = eventSnap.exists ? (eventSnap.data() as EventDoc) : null;
  return { db, ref, r, event };
}

/**
 * 학생 응답 본문 수정. 관리자가 오타나 부적절한 표현을 고칠 때 쓴다.
 * 문항별 답(answers)은 본문과 어긋나므로 지우고, 이후 화면과 출력은 본문을 쓴다.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ responseId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { responseId } = await params;
    const body = await readJson<PatchBody>(req);
    const content = (body.content ?? "").trim();
    if (!content) throw badRequest("내용을 입력해주세요. 비우려면 삭제를 쓰세요.");
    if (countCharacters(content) > MAX_ANSWER_LENGTH) {
      throw badRequest(`${MAX_ANSWER_LENGTH}자 이내로 작성해주세요.`);
    }

    const { ref, r } = await load(responseId);
    const hadContent = Boolean(r.content?.trim());
    await ref.update({ content, answers: FieldValue.delete(), updatedAt: Date.now() });

    // 비어 있던 응답에 내용이 생기는 경우는 만들지 않으므로(위에서 막음) 카운터는 그대로.
    return { ok: true, wasEmpty: !hadContent };
  });
}

/** 학생 응답 삭제. 제출 인원과 학생별 기록 수를 함께 되돌린다. */
export async function DELETE(req: Request, { params }: { params: Promise<{ responseId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { responseId } = await params;
    const { db, ref, r, event } = await load(responseId);

    const hadContent = Boolean(r.content?.trim());
    const noteSnap = await db.collection(COL.notes).doc(noteId(r.eventId, r.rosterId)).get();
    const hasNote = Boolean((noteSnap.data() as { content?: string } | undefined)?.content?.trim());

    const batch = db.batch();
    batch.delete(ref);
    if (hadContent) {
      batch.update(db.collection(COL.events).doc(r.eventId), {
        submittedCount: FieldValue.increment(-1),
      });
    }
    if (event) {
      const delta = materialDelta(hadContent || hasNote, hasNote);
      if (delta !== 0) {
        batch.update(db.collection(COL.roster).doc(r.rosterId), {
          [rosterCountField(event.category)]: FieldValue.increment(delta),
        });
      }
    }
    await batch.commit();
    return { ok: true };
  });
}
