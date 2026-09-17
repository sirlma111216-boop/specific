import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { resolveForm } from "@/lib/forms/schema";
import { sanitizeForm } from "@/lib/forms/sanitize-server";
import { commitInChunks } from "@/lib/firebase/batch";
import { rosterCountField } from "@/lib/events/counters";
import { rostersWithMaterialFor } from "@/lib/events/material";
import { isValidIsoDate } from "@/lib/utils";
import type { Category, EventDoc, EventStatus } from "@/lib/types";

interface PatchBody {
  title?: string;
  category?: string;
  description?: string;
  guidance?: string;
  eventDate?: string;
  status?: string;
  isTest?: boolean;
  form?: unknown;
}

const CATEGORIES: Category[] = ["autonomous", "career"];
const STATUSES: EventStatus[] = ["scheduled", "open", "closed"];

async function loadEvent(eventId: string) {
  const ref = adminDb().collection(COL.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("활동을 찾을 수 없습니다.");
  return { ref, event: snap.data() as EventDoc };
}

/**
 * 활동 수정. 기본 정보(제목·영역·날짜·설명·안내문), 공개 상태, 테스트 여부, 양식.
 *
 * 영역(자율↔진로)을 바꾸면 이 활동에 기록이 있는 학생들의 자율/진로 기록 수 카운터를
 * 옛 영역에서 새 영역으로 옮긴다. 안 옮기면 교사 학생 목록의 숫자가 어긋난다.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { eventId } = await params;
    const { ref, event } = await loadEvent(eventId);
    const body = await readJson<PatchBody>(req);
    const db = adminDb();

    const update: Partial<EventDoc> = { updatedAt: Date.now() };

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) throw badRequest("활동명을 입력해주세요.");
      update.title = title;
    }
    if (body.description !== undefined) update.description = body.description.trim();
    if (body.guidance !== undefined) update.guidance = body.guidance.trim();
    if (body.eventDate !== undefined) {
      if (!isValidIsoDate(body.eventDate)) throw badRequest("활동 날짜를 올바르게 입력해주세요.");
      update.eventDate = body.eventDate;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as EventStatus)) {
        throw badRequest("활동 상태 값이 올바르지 않습니다.");
      }
      update.status = body.status as EventStatus;
    }
    if (body.isTest !== undefined) update.isTest = Boolean(body.isTest);
    if (body.form !== undefined) update.form = sanitizeForm(body.form);

    let movedCounters = 0;
    if (body.category !== undefined && body.category !== event.category) {
      if (!CATEGORIES.includes(body.category as Category)) {
        throw badRequest("활동 영역 값이 올바르지 않습니다.");
      }
      const next = body.category as Category;
      update.category = next;

      const { rosterIds } = await rostersWithMaterialFor(eventId);
      const from = rosterCountField(event.category);
      const to = rosterCountField(next);
      const ops: Array<(b: FirebaseFirestore.WriteBatch) => void> = [];
      for (const rosterId of rosterIds) {
        ops.push((b) =>
          b.update(db.collection(COL.roster).doc(rosterId), {
            [from]: FieldValue.increment(-1),
            [to]: FieldValue.increment(1),
          }),
        );
      }
      await commitInChunks(ops);
      movedCounters = rosterIds.size;
    }

    await ref.update(update);
    const fresh = await ref.get();
    const saved = fresh.data() as EventDoc;
    return { event: { ...saved, form: resolveForm(saved.form) }, movedCounters };
  });
}

/**
 * 활동 삭제. 관리자는 학생 응답이 있어도 지울 수 있다.
 *
 * 그냥 활동만 지우면 학생 응답·교사 보완본이 주인 없이 남고,
 * 학생별 기록 수 카운터가 실제와 어긋난다. 그래서 딸린 자료를 함께 정리한다.
 * 되돌릴 수 없으므로 화면에서 삭제될 응답 수를 알리고 확인을 받는다.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { eventId } = await params;
    const { ref, event } = await loadEvent(eventId);
    const db = adminDb();

    const { rosterIds, responses, notes } = await rostersWithMaterialFor(eventId);

    const countField = rosterCountField(event.category);
    const ops: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    responses.forEach((d) => ops.push((b) => b.delete(d.ref)));
    notes.forEach((d) => ops.push((b) => b.delete(d.ref)));
    for (const rosterId of rosterIds) {
      ops.push((b) =>
        b.update(db.collection(COL.roster).doc(rosterId), {
          [countField]: FieldValue.increment(-1),
        }),
      );
    }
    ops.push((b) => b.delete(ref));

    await commitInChunks(ops);

    return {
      ok: true,
      deletedResponses: responses.size,
      deletedNotes: notes.size,
      affectedStudents: rosterIds.size,
    };
  });
}
