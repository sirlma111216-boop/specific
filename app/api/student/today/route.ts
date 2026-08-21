import { adminDb, COL } from "@/lib/firebase/admin";
import { requireStudent } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { computeEventPhase } from "@/lib/events/phase";
import { resolveForm } from "@/lib/forms/schema";
import { todayInKST } from "@/lib/utils";
import type { EventDoc, ResponseDoc, StudentEventItem } from "@/lib/types";

/**
 * 로그인 직후 바로 보여줄 "지금 작성해야 할 활동" 목록.
 * 학생 본인의 응답만 조회하며, 다른 학생의 자료는 어떤 필드로도 나가지 않는다.
 */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireStudent(req);
    const db = adminDb();
    const today = todayInKST();

    const [eventSnap, mySnap] = await Promise.all([
      db.collection(COL.events).get(),
      db.collection(COL.responses).where("studentUid", "==", ctx.uid).get(),
    ]);

    const myResponses = new Map<string, ResponseDoc>();
    mySnap.forEach((d) => {
      const r = d.data() as ResponseDoc;
      myResponses.set(r.eventId, r);
    });

    const pending: StudentEventItem[] = eventSnap.docs
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
          form: resolveForm(e.form),
          answers: mine?.answers ?? null,
        };
      })
      .filter((e) => e.phase === "writable")
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.title.localeCompare(b.title));

    return { today, pending };
  });
}
