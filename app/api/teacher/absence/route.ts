import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { eventVisibleTo } from "@/lib/events/visibility";
import type { EventDoc, RosterDoc } from "@/lib/types";

interface Body {
  rosterId?: string;
  eventId?: string;
  absent?: boolean;
}

/**
 * 담임이 학생의 활동 결석을 표시하거나 푼다.
 * - 결석으로 표시한 활동은 교사 화면에서 체크할 수 없고, 특기사항 생성에도 넣지 않는다.
 * - 뒤집기가 아니라 원하는 상태(absent)를 받는다. 두 번 전송돼도 결과가 같다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const body = await readJson<Body>(req);
    const rosterId = (body.rosterId ?? "").trim();
    const eventId = (body.eventId ?? "").trim();

    if (!rosterId) throw badRequest("학생을 선택해주세요.");
    if (!eventId) throw badRequest("활동을 선택해주세요.");
    if (typeof body.absent !== "boolean") throw badRequest("결석 여부 값이 올바르지 않습니다.");

    const db = adminDb();
    const ref = db.collection(COL.roster).doc(rosterId);
    // 활동 목록 캐시는 인스턴스마다 늦게 갱신될 수 있어, 방금 만든 활동도 찾도록 문서를 직접 읽는다.
    const [rosterSnap, eventSnap] = await Promise.all([
      ref.get(),
      db.collection(COL.events).doc(eventId).get(),
    ]);

    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    if (!eventSnap.exists) throw notFound("활동을 찾을 수 없습니다.");
    if ((rosterSnap.data() as RosterDoc).classId !== ctx.classId) {
      throw notFound("학생을 찾을 수 없습니다.");
    }
    if (!eventVisibleTo(eventSnap.data() as EventDoc, ctx.isTest)) {
      throw notFound("활동을 찾을 수 없습니다.");
    }

    await ref.update({
      absentEventIds: body.absent
        ? FieldValue.arrayUnion(eventId)
        : FieldValue.arrayRemove(eventId),
    });

    return { ok: true, absent: body.absent };
  });
}
