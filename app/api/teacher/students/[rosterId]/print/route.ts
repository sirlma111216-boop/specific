import { adminDb, COL } from "@/lib/firebase/admin";
import { forbidden, notFound } from "@/lib/api-error";
import { getAuthContext } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { eventVisibleTo } from "@/lib/events/visibility";
import { DEFAULT_QUESTION_LABEL, resolveForm, type FormAnswers } from "@/lib/forms/schema";
import type { ClassDoc, EventDoc, ResponseDoc, RosterDoc } from "@/lib/types";

export interface PrintRow {
  eventId: string;
  category: EventDoc["category"];
  eventDate: string;
  title: string;
  /** 문항과 학생 답. 양식 순서대로, 양식에서 사라진 문항은 뒤에 붙는다. */
  entries: Array<{ label: string; answer: string }>;
  writtenAt: number;
}

/**
 * 학생 누가기록 출력용 자료.
 *
 * 학교가 근거 자료로 보관하는 문서이므로 **학생이 직접 쓴 내용만** 담는다.
 * 교사 보완본·AI 초안·특기사항은 넣지 않는다. 학생이 쓰지 않은 활동도 넣지 않는다.
 * 담임(자기 학급)과 관리자가 볼 수 있다.
 */
export async function GET(req: Request, { params }: { params: Promise<{ rosterId: string }> }) {
  return route(async () => {
    const ctx = await getAuthContext(req);
    const { rosterId } = await params;
    const db = adminDb();

    const rosterSnap = await db.collection(COL.roster).doc(rosterId).get();
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const roster = rosterSnap.data() as RosterDoc;

    if (ctx.role === "teacher") {
      if (roster.classId !== ctx.classId) throw notFound("학생을 찾을 수 없습니다.");
    } else if (ctx.role !== "admin") {
      throw forbidden("교사 또는 관리자만 볼 수 있습니다.");
    }

    const [classSnap, eventSnap, responseSnap] = await Promise.all([
      db.collection(COL.classes).doc(roster.classId).get(),
      db.collection(COL.events).get(),
      db.collection(COL.responses).where("rosterId", "==", rosterId).get(),
    ]);
    const klass = classSnap.data() as ClassDoc | undefined;
    if (!klass) throw notFound("학급 정보를 찾을 수 없습니다.");

    const eventById = new Map<string, EventDoc>();
    eventSnap.forEach((d) => {
      const e = d.data() as EventDoc;
      if (eventVisibleTo(e, Boolean(klass.isTest))) eventById.set(e.eventId, e);
    });

    const rows: PrintRow[] = [];
    responseSnap.forEach((d) => {
      const r = d.data() as ResponseDoc;
      if (!r.content?.trim()) return;
      const e = eventById.get(r.eventId);
      if (!e) return;
      rows.push({
        eventId: e.eventId,
        category: e.category,
        eventDate: e.eventDate,
        title: e.title,
        entries: entriesFor(e, r),
        writtenAt: r.updatedAt ?? r.createdAt,
      });
    });
    rows.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.title.localeCompare(b.title));

    return {
      klass: {
        schoolYear: klass.schoolYear,
        grade: klass.grade,
        classNumber: klass.classNumber,
        teacherName: klass.teacherName,
      },
      student: { studentNumber: roster.studentNumber, studentName: roster.studentName },
      rows,
      printedAt: Date.now(),
    };
  });
}

/** 문항별 답. 답이 문항 단위로 남아 있지 않은 옛 응답은 본문 전체를 한 칸으로 둔다. */
function entriesFor(event: EventDoc, r: ResponseDoc): PrintRow["entries"] {
  const form = resolveForm(event.form);
  const answers: FormAnswers = r.answers ?? {};
  const has = Object.keys(answers).length > 0;

  if (!has) {
    const label = form.length === 1 ? form[0].label : DEFAULT_QUESTION_LABEL;
    return [{ label, answer: r.content.trim() }];
  }

  const out: PrintRow["entries"] = [];
  const seen = new Set<string>();
  for (const q of form) {
    const raw = answers[q.id];
    seen.add(q.id);
    const text = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
    if (!text.trim()) continue;
    out.push({ label: q.label, answer: text.trim() });
  }
  // 학생이 답한 뒤 양식에서 사라진 문항도 기록은 남겨야 한다.
  for (const [id, raw] of Object.entries(answers)) {
    if (seen.has(id)) continue;
    const text = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
    if (!text.trim()) continue;
    out.push({ label: "(양식에서 삭제된 문항)", answer: text.trim() });
  }
  return out;
}
