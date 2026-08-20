import { adminDb, COL } from "@/lib/firebase/admin";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import type {
  EventDoc,
  ResponseDoc,
  RosterDoc,
  StudentListItem,
  TeacherNoteDoc,
} from "@/lib/types";

/** 학급 전체 학생 목록 + 가입 상태 + 영역별 기록 수 */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const db = adminDb();

    const [rosterSnap, eventSnap, responseSnap, noteSnap] = await Promise.all([
      db.collection(COL.roster).where("classId", "==", ctx.classId).get(),
      db.collection(COL.events).where("classId", "==", ctx.classId).get(),
      db.collection(COL.responses).where("classId", "==", ctx.classId).get(),
      db.collection(COL.notes).where("classId", "==", ctx.classId).get(),
    ]);

    const categoryByEvent = new Map<string, EventDoc["category"]>();
    eventSnap.forEach((d) => {
      const e = d.data() as EventDoc;
      categoryByEvent.set(e.eventId, e.category);
    });

    // 학생 원문과 교사 보완본을 합쳐, 학생·활동 단위로 한 번만 센다.
    const filled = new Set<string>();
    const add = (rosterId: string, eventId: string, content: string) => {
      if (content.trim()) filled.add(`${rosterId}|${eventId}`);
    };
    responseSnap.forEach((d) => {
      const r = d.data() as ResponseDoc;
      add(r.rosterId, r.eventId, r.content ?? "");
    });
    noteSnap.forEach((d) => {
      const n = d.data() as TeacherNoteDoc;
      add(n.rosterId, n.eventId, n.content ?? "");
    });

    const counts = new Map<string, { autonomous: number; career: number }>();
    for (const key of filled) {
      const [rosterId, eventId] = key.split("|");
      const category = categoryByEvent.get(eventId);
      if (!category) continue;
      const bucket = counts.get(rosterId) ?? { autonomous: 0, career: 0 };
      bucket[category] += 1;
      counts.set(rosterId, bucket);
    }

    const students: StudentListItem[] = rosterSnap.docs
      .map((d) => d.data() as RosterDoc)
      .map((r) => {
        const bucket = counts.get(r.rosterId) ?? { autonomous: 0, career: 0 };
        return {
          rosterId: r.rosterId,
          studentNumber: r.studentNumber,
          studentName: r.studentName,
          signupStatus: r.signupStatus,
          autonomousCount: bucket.autonomous,
          careerCount: bucket.career,
        };
      })
      .sort((a, b) => a.studentNumber - b.studentNumber);

    return { students };
  });
}
