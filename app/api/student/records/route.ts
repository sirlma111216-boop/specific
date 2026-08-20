import { adminDb, COL } from "@/lib/firebase/admin";
import { requireStudent } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { computeEventPhase } from "@/lib/events/phase";
import { todayInKST } from "@/lib/utils";
import type { EventDoc, ResponseDoc, StudentEventItem } from "@/lib/types";

/**
 * 학생 본인의 지난 활동 기록.
 *
 * 여기서 내려가는 것은 학급의 활동 정보와 "본인이 직접 쓴 내용"뿐이다.
 * 교사가 체크한 활동, 선택 순서, AI 생성 결과, 최종 특기사항은 어떤 필드로도 포함되지 않는다.
 */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireStudent(req);
    const db = adminDb();
    const today = todayInKST();

    const [eventSnap, mySnap] = await Promise.all([
      db.collection(COL.events).where("classId", "==", ctx.classId).get(),
      db.collection(COL.responses).where("studentUid", "==", ctx.uid).get(),
    ]);

    const myResponses = new Map<string, ResponseDoc>();
    mySnap.forEach((d) => {
      const r = d.data() as ResponseDoc;
      myResponses.set(r.eventId, r);
    });

    const items: StudentEventItem[] = eventSnap.docs
      .map((d) => d.data() as EventDoc)
      .map((e) => {
        const mine = myResponses.get(e.eventId);
        const hasResponse = Boolean(mine?.content?.trim());
        return {
          eventId: e.eventId,
          category: e.category,
          title: e.title,
          description: e.description,
          guidance: e.guidance,
          eventDate: e.eventDate,
          phase: computeEventPhase(e.status, e.eventDate, today, hasResponse),
          content: mine?.content ?? null,
          updatedAt: mine?.updatedAt ?? null,
        };
      })
      // 아직 공개되지 않은 활동은 학생에게 미리 보여주지 않는다.
      .filter((e) => e.phase !== "scheduled")
      .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.title.localeCompare(b.title));

    return { today, items };
  });
}
