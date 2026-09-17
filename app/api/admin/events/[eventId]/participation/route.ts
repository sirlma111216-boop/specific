import { adminDb, COL } from "@/lib/firebase/admin";
import { notFound } from "@/lib/api-error";
import { requireStaff } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { sortClassSummaries } from "@/lib/admin/lookup";
import { safeCount } from "@/lib/events/counters";
import { cached } from "@/lib/server-cache";
import { formatClassFull } from "@/lib/utils";
import type { ClassDoc, EventDoc, ResponseDoc } from "@/lib/types";

/**
 * 활동 참여 현황 — 학급별 작성 인원.
 *
 * 일정 관리자가 보는 화면이므로 **개별 학생 정보는 담지 않는다**. 학급 이름과 숫자뿐이다.
 * 테스트 활동이면 테스트 학급만, 실제 활동이면 실제 학급만 센다.
 */
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    await requireStaff(req);
    const { eventId } = await params;
    const db = adminDb();

    const eventSnap = await db.collection(COL.events).doc(eventId).get();
    if (!eventSnap.exists) throw notFound("활동을 찾을 수 없습니다.");
    const event = eventSnap.data() as EventDoc;

    // 참여 현황은 감시용이라 수십 초 지연은 괜찮다. 이벤트당 최대 수백 건(응답 전체)을
    // 읽으므로, 반복 조회 시 60초 캐시로 재사용해 읽기 폭을 막는다.
    const { classDocs, submittedByClass } = await cached(
      `participation:${eventId}`,
      60 * 1000,
      async () => {
        const [classSnap, responseSnap] = await Promise.all([
          db.collection(COL.classes).get(),
          db.collection(COL.responses).where("eventId", "==", eventId).get(),
        ]);
        const byClass = new Map<string, number>();
        responseSnap.forEach((d) => {
          const r = d.data() as ResponseDoc;
          if (!r.content?.trim()) return;
          byClass.set(r.classId, (byClass.get(r.classId) ?? 0) + 1);
        });
        return { classDocs: classSnap.docs.map((d) => d.data() as ClassDoc), submittedByClass: byClass };
      },
    );

    const classes = sortClassSummaries(
      classDocs
        .filter((c) => Boolean(c.isTest) === Boolean(event.isTest))
        .map((c) => ({
          classId: c.classId,
          schoolYear: c.schoolYear,
          grade: c.grade,
          classNumber: c.classNumber,
          isTest: Boolean(c.isTest),
          label: formatClassFull(c.schoolYear, c.grade, c.classNumber),
          studentCount: safeCount(c.studentCount),
          submitted: submittedByClass.get(c.classId) ?? 0,
        })),
    ).map(({ classId, label, studentCount, submitted }) => ({ classId, label, studentCount, submitted }));

    const total = classes.reduce(
      (acc, c) => ({ students: acc.students + c.studentCount, submitted: acc.submitted + c.submitted }),
      { students: 0, submitted: 0 },
    );

    return {
      event: { eventId: event.eventId, title: event.title, eventDate: event.eventDate, isTest: Boolean(event.isTest) },
      total,
      classes,
    };
  });
}
