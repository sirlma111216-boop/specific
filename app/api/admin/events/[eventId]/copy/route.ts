import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireStaff } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { resolveForm } from "@/lib/forms/schema";
import { invalidateEvents } from "@/lib/events/load";
import { isValidIsoDate } from "@/lib/utils";
import type { EventDoc, EventStatus } from "@/lib/types";

interface Body {
  eventDate?: string;
  status?: string;
}

const STATUSES: EventStatus[] = ["scheduled", "open", "closed"];

/**
 * 활동 복사. 양식·제목·설명·안내문·영역·테스트 여부는 그대로, 날짜와 공개 상태만 새로 받는다.
 * 매년 같은 교육(학교폭력 예방교육 등)을 다시 열 때 양식을 다시 만들지 않기 위함이다.
 * 응답·제출 인원은 옮기지 않는다 — 새 활동은 빈 상태로 시작한다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    const ctx = await requireStaff(req);
    const { eventId } = await params;
    const body = await readJson<Body>(req);

    const eventDate = (body.eventDate ?? "").trim();
    const status = (body.status ?? "scheduled") as EventStatus;
    if (!isValidIsoDate(eventDate)) throw badRequest("새 활동 날짜를 올바르게 입력해주세요.");
    if (!STATUSES.includes(status)) throw badRequest("활동 상태 값이 올바르지 않습니다.");

    const db = adminDb();
    const srcSnap = await db.collection(COL.events).doc(eventId).get();
    if (!srcSnap.exists) throw notFound("복사할 활동을 찾을 수 없습니다.");
    const src = srcSnap.data() as EventDoc;

    const ref = db.collection(COL.events).doc();
    const now = Date.now();
    const doc: EventDoc = {
      eventId: ref.id,
      category: src.category,
      title: src.title,
      description: src.description,
      guidance: src.guidance,
      eventDate,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
      submittedCount: 0,
      form: resolveForm(src.form),
      ...(src.isTest ? { isTest: true } : {}),
    };
    await ref.set(doc);
    invalidateEvents();
    return { event: doc };
  });
}
