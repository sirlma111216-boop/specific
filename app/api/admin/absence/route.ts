import { FieldValue } from "firebase-admin/firestore";
import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";

interface Body {
  rosterId?: string;
  eventId?: string;
  absent?: boolean;
}

/**
 * 슈퍼관리자가 학생의 활동 결석을 표시하거나 푼다.
 * 담임 화면(/api/teacher/absence)과 같은 자리(studentRoster.absentEventIds)에 쓰므로
 * 어느 쪽에서 바꿔도 양쪽 화면에 똑같이 보인다. 학급 제한 없이 모든 학생에게 쓸 수 있다.
 * 뒤집기가 아니라 원하는 상태(absent)를 받는다. 두 번 전송돼도 결과가 같다.
 */
export async function POST(req: Request) {
  return route(async () => {
    await requireAdmin(req);
    const body = await readJson<Body>(req);
    const rosterId = (body.rosterId ?? "").trim();
    const eventId = (body.eventId ?? "").trim();

    if (!rosterId) throw badRequest("학생을 선택해주세요.");
    if (!eventId) throw badRequest("활동을 선택해주세요.");
    if (typeof body.absent !== "boolean") throw badRequest("결석 여부 값이 올바르지 않습니다.");

    const db = adminDb();
    const ref = db.collection(COL.roster).doc(rosterId);
    const [rosterSnap, eventSnap] = await Promise.all([
      ref.get(),
      db.collection(COL.events).doc(eventId).get(),
    ]);
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    if (!eventSnap.exists) throw notFound("활동을 찾을 수 없습니다.");

    await ref.update({
      absentEventIds: body.absent
        ? FieldValue.arrayUnion(eventId)
        : FieldValue.arrayRemove(eventId),
    });

    return { ok: true, absent: body.absent };
  });
}
