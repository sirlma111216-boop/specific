import { adminDb, COL } from "@/lib/firebase/admin";
import { notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { eventVisibleTo } from "@/lib/events/visibility";
import { loadAllEvents } from "@/lib/events/load";
import { resolveForm } from "@/lib/forms/schema";
import type {
  ClassDoc,
  ResponseDoc,
  RosterDoc,
  StudentRecordDoc,
  TeacherNoteDoc,
  UserDoc,
} from "@/lib/types";

/**
 * 관리자용 학생 상세. 담임 화면과 달리 생성 작업은 없고, 이 학생에게 딸린 자료를
 * 전부 보고 고치고 지울 수 있게 한다.
 * 학생이 쓴 원문·교사 보완본·저장된 특기사항을 활동별로 한 줄에 모은다.
 */
export async function GET(req: Request, { params }: { params: Promise<{ rosterId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { rosterId } = await params;
    const db = adminDb();

    const rosterSnap = await db.collection(COL.roster).doc(rosterId).get();
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const roster = rosterSnap.data() as RosterDoc;

    const [classSnap, userSnap, events, responseSnap, noteSnap, recordSnap] = await Promise.all([
      db.collection(COL.classes).doc(roster.classId).get(),
      roster.linkedUserId ? db.collection(COL.users).doc(roster.linkedUserId).get() : null,
      loadAllEvents(),
      db.collection(COL.responses).where("rosterId", "==", rosterId).get(),
      db.collection(COL.notes).where("rosterId", "==", rosterId).get(),
      db.collection(COL.records).where("rosterId", "==", rosterId).get(),
    ]);
    const klass = classSnap.data() as ClassDoc | undefined;
    const user = userSnap?.exists ? (userSnap.data() as UserDoc) : null;

    const responses = new Map<string, ResponseDoc>();
    responseSnap.forEach((d) => responses.set((d.data() as ResponseDoc).eventId, d.data() as ResponseDoc));
    const notes = new Map<string, TeacherNoteDoc>();
    noteSnap.forEach((d) => notes.set((d.data() as TeacherNoteDoc).eventId, d.data() as TeacherNoteDoc));

    const visibleEvents = events
      .filter((e) => eventVisibleTo(e, Boolean(klass?.isTest)))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.title.localeCompare(b.title))
      .map((e) => {
        const r = responses.get(e.eventId);
        const n = notes.get(e.eventId);
        return {
          eventId: e.eventId,
          category: e.category,
          title: e.title,
          eventDate: e.eventDate,
          status: e.status,
          form: resolveForm(e.form),
          response: r
            ? {
                responseId: r.responseId,
                content: r.content,
                answers: r.answers ?? null,
                updatedAt: r.updatedAt,
              }
            : null,
          note: n ? { noteId: n.noteId, content: n.content, updatedAt: n.updatedAt } : null,
        };
      });

    const records = recordSnap.docs
      .map((d) => d.data() as StudentRecordDoc)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => ({
        recordId: r.recordId,
        category: r.category,
        editedText: r.editedText,
        generatedText: r.generatedText,
        finalCharacterCount: r.finalCharacterCount,
        updatedAt: r.updatedAt,
        teacherId: r.teacherId,
      }));

    return {
      student: {
        rosterId: roster.rosterId,
        studentNumber: roster.studentNumber,
        studentName: roster.studentName,
        signupStatus: roster.signupStatus,
        autonomousCount: roster.autonomousCount ?? 0,
        careerCount: roster.careerCount ?? 0,
        officerTerms: roster.officerTerms ?? [],
      },
      klass: klass
        ? {
            classId: klass.classId,
            schoolYear: klass.schoolYear,
            grade: klass.grade,
            classNumber: klass.classNumber,
            teacherName: klass.teacherName,
            isTest: Boolean(klass.isTest),
          }
        : null,
      account: user
        ? { uid: roster.linkedUserId, email: user.email, createdAt: user.createdAt }
        : null,
      events: visibleEvents,
      records,
    };
  });
}
