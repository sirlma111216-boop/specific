import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { isValidIsoDate } from "@/lib/utils";
import type { EventDoc, EventStatus } from "@/lib/types";

interface PatchBody {
  title?: string;
  description?: string;
  guidance?: string;
  eventDate?: string;
  status?: string;
}

const STATUSES: EventStatus[] = ["scheduled", "open", "closed"];

async function loadOwnEvent(classId: string, eventId: string) {
  const ref = adminDb().collection(COL.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("활동을 찾을 수 없습니다.");
  const event = snap.data() as EventDoc;
  if (event.classId !== classId) throw notFound("활동을 찾을 수 없습니다.");
  return { ref, event };
}

/** 활동 수정 · 지금 공개 · 마감 · 다시 열기 */
export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const { eventId } = await params;
    const { ref } = await loadOwnEvent(ctx.classId, eventId);
    const body = await readJson<PatchBody>(req);

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

    await ref.update(update);
    const fresh = await ref.get();
    return { event: fresh.data() as EventDoc };
  });
}

/** 학생 기록이 하나라도 있으면 삭제하지 않는다. */
export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const { eventId } = await params;
    const { ref } = await loadOwnEvent(ctx.classId, eventId);

    const responses = await adminDb()
      .collection(COL.responses)
      .where("eventId", "==", eventId)
      .limit(1)
      .get();
    if (!responses.empty) {
      throw badRequest(
        "학생이 작성한 기록이 있는 활동은 삭제할 수 없습니다. 필요하면 마감 처리해주세요.",
        "has_responses",
      );
    }

    await ref.delete();
    return { ok: true };
  });
}
