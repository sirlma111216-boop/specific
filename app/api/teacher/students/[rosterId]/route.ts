import { adminDb, COL } from "@/lib/firebase/admin";
import { notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { mergeReflection } from "@/lib/events/reflection";
import type {
  Category,
  EventDoc,
  ResponseDoc,
  RosterDoc,
  StudentRecordDoc,
  TeacherEventWithResponse,
  TeacherNoteDoc,
} from "@/lib/types";

/**
 * 교사용 학생 상세.
 * 자율/진로 전체 활동 목록 + 그 학생이 쓴 소감 + 저장된 특기사항을 함께 내려준다.
 * 학생 기록이 없는 활동도 반드시 목록에 포함된다(교사가 체크할 수 있어야 하므로).
 */
export async function GET(req: Request, { params }: { params: Promise<{ rosterId: string }> }) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const { rosterId } = await params;
    const db = adminDb();

    const rosterSnap = await db.collection(COL.roster).doc(rosterId).get();
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const roster = rosterSnap.data() as RosterDoc;
    if (roster.classId !== ctx.classId) throw notFound("학생을 찾을 수 없습니다.");

    const [eventSnap, responseSnap, noteSnap, recordSnap, classRosterSnap] = await Promise.all([
      db.collection(COL.events).where("classId", "==", ctx.classId).get(),
      db.collection(COL.responses).where("rosterId", "==", rosterId).get(),
      db.collection(COL.notes).where("rosterId", "==", rosterId).get(),
      db.collection(COL.records).where("rosterId", "==", rosterId).get(),
      db.collection(COL.roster).where("classId", "==", ctx.classId).get(),
    ]);

    // 학생이 직접 쓴 원문
    const studentText = new Map<string, string>();
    responseSnap.forEach((d) => {
      const r = d.data() as ResponseDoc;
      if (r.content?.trim()) studentText.set(r.eventId, r.content.trim());
    });

    // 교사가 보완한 내용 (있으면 이쪽이 최종 자료)
    const teacherText = new Map<string, string>();
    noteSnap.forEach((d) => {
      const n = d.data() as TeacherNoteDoc;
      if (n.content?.trim()) teacherText.set(n.eventId, n.content.trim());
    });

    const all = eventSnap.docs
      .map((d) => d.data() as EventDoc)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      .map<TeacherEventWithResponse>((e) => ({
        eventId: e.eventId,
        category: e.category,
        title: e.title,
        description: e.description,
        eventDate: e.eventDate,
        status: e.status,
        ...mergeReflection(studentText.get(e.eventId) ?? "", teacherText.get(e.eventId) ?? ""),
      }));

    const events: Record<Category, TeacherEventWithResponse[]> = {
      autonomous: all.filter((e) => e.category === "autonomous"),
      career: all.filter((e) => e.category === "career"),
    };

    const records: Partial<Record<Category, StudentRecordDoc>> = {};
    recordSnap.forEach((d) => {
      const r = d.data() as StudentRecordDoc;
      if (r.teacherId === ctx.uid) records[r.category] = r;
    });

    // 학생 목록으로 돌아가지 않고 이전/다음 학생으로 이동하기 위한 정보
    const ordered = classRosterSnap.docs
      .map((d) => d.data() as RosterDoc)
      .sort((a, b) => a.studentNumber - b.studentNumber);
    const index = ordered.findIndex((r) => r.rosterId === rosterId);
    const neighbors = {
      prev: index > 0 ? pick(ordered[index - 1]) : null,
      next: index >= 0 && index < ordered.length - 1 ? pick(ordered[index + 1]) : null,
      position: index + 1,
      total: ordered.length,
    };

    return {
      student: {
        rosterId: roster.rosterId,
        studentNumber: roster.studentNumber,
        studentName: roster.studentName,
        signupStatus: roster.signupStatus,
      },
      events,
      records,
      neighbors,
    };
  });
}

function pick(r: RosterDoc) {
  return { rosterId: r.rosterId, studentNumber: r.studentNumber, studentName: r.studentName };
}
