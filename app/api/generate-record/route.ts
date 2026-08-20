import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { GeminiError, isGeminiConfigured } from "@/lib/gemini/client";
import { generateStudentRecord } from "@/lib/record-generator/generate";
import type { SelectableEvent } from "@/lib/record-generator/select";
import { MAX_TARGET_LENGTH, MIN_TARGET_LENGTH } from "@/lib/events/defaults";
import { ApiError } from "@/lib/api-error";
import type {
  Category,
  ClassDoc,
  EventDoc,
  ResponseDoc,
  RosterDoc,
  SelectionMode,
  TeacherNoteDoc,
} from "@/lib/types";

interface Body {
  rosterId?: string;
  category?: string;
  selectedEventIds?: string[];
  selectionOrder?: Record<string, number>;
  selectionMode?: string;
  targetLength?: number;
}

const CATEGORIES: Category[] = ["autonomous", "career"];
const MODES: SelectionMode[] = ["priority", "random"];

/**
 * 생기부 특기사항 초안 생성.
 * Gemini 호출은 이 서버 라우트 안에서만 일어나며, API Key는 클라이언트로 나가지 않는다.
 * 호출 직전 sanitizeRecordGenerationPayload()로 개인정보를 제거한다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    if (!isGeminiConfigured()) {
      throw new ApiError(500, "서버에 GEMINI_API_KEY가 설정되지 않았습니다. (SETUP.md 참고)");
    }

    const body = await readJson<Body>(req);
    const rosterId = (body.rosterId ?? "").trim();
    const category = body.category as Category;
    const selectionMode = (body.selectionMode as SelectionMode) ?? "priority";
    const targetLength = Number(body.targetLength);
    const selectedEventIds = Array.isArray(body.selectedEventIds) ? body.selectedEventIds : [];
    const selectionOrder = body.selectionOrder ?? {};

    if (!rosterId) throw badRequest("학생을 선택해주세요.");
    if (!CATEGORIES.includes(category)) throw badRequest("활동 영역을 선택해주세요.");
    if (!MODES.includes(selectionMode)) throw badRequest("활동 반영 방식을 선택해주세요.");
    if (!Number.isFinite(targetLength) || targetLength < MIN_TARGET_LENGTH || targetLength > MAX_TARGET_LENGTH) {
      throw badRequest(`목표 글자 수는 ${MIN_TARGET_LENGTH}~${MAX_TARGET_LENGTH} 사이로 입력해주세요.`);
    }
    if (selectedEventIds.length === 0) throw badRequest("반영할 활동을 하나 이상 선택해주세요.");

    const db = adminDb();
    const rosterSnap = await db.collection(COL.roster).doc(rosterId).get();
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const roster = rosterSnap.data() as RosterDoc;
    if (roster.classId !== ctx.classId) throw notFound("학생을 찾을 수 없습니다.");

    const [classSnap, eventSnap, responseSnap, noteSnap] = await Promise.all([
      db.collection(COL.classes).doc(ctx.classId).get(),
      db.collection(COL.events).where("classId", "==", ctx.classId).get(),
      db.collection(COL.responses).where("rosterId", "==", rosterId).get(),
      db.collection(COL.notes).where("rosterId", "==", rosterId).get(),
    ]);
    const klass = classSnap.data() as ClassDoc | undefined;

    const eventById = new Map<string, EventDoc>();
    eventSnap.forEach((d) => {
      const e = d.data() as EventDoc;
      eventById.set(e.eventId, e);
    });

    // 학생 원문 위에 교사 보완본을 덮어 최종 자료를 만든다.
    const reflections = new Map<string, string>();
    responseSnap.forEach((d) => {
      const r = d.data() as ResponseDoc;
      if (r.content?.trim()) reflections.set(r.eventId, r.content.trim());
    });
    noteSnap.forEach((d) => {
      const n = d.data() as TeacherNoteDoc;
      if (n.content?.trim()) reflections.set(n.eventId, n.content.trim());
    });

    const events: SelectableEvent[] = [];
    for (const id of selectedEventIds) {
      const e = eventById.get(id);
      if (!e) throw badRequest("선택한 활동 중 찾을 수 없는 항목이 있습니다.");
      if (e.category !== category) {
        throw badRequest("다른 영역의 활동이 섞여 있습니다. 자율/진로를 나누어 생성해주세요.");
      }
      const reflection = reflections.get(id) ?? "";
      events.push({
        eventId: e.eventId,
        title: e.title,
        description: e.description,
        eventDate: e.eventDate,
        studentReflection: reflection,
        hasStudentReflection: reflection.length > 0,
        teacherSelectionOrder: selectionOrder[id] ?? selectedEventIds.indexOf(id) + 1,
      });
    }

    // Gemini로 나가기 전에 가려야 할 식별자들
    const identifiersToRedact = [
      roster.studentName,
      klass?.schoolName ?? "",
      klass?.teacherName ?? "",
      ctx.email,
    ].filter(Boolean);

    try {
      const result = await generateStudentRecord({
        category,
        targetLength,
        selectionMode,
        events,
        identifiersToRedact,
      });

      return {
        text: result.text,
        characterCount: result.characterCount,
        targetLength,
        usedEventIds: result.usedEventIds,
        usedEventTitles: result.usedEventTitles,
        remainingIssues: result.remainingIssues.map((i) => ({ code: i.code, message: i.message })),
        repairAttempts: result.repairAttempts,
        // 개인정보가 제거된 실제 전송 payload (교사가 직접 확인할 수 있도록 그대로 반환)
        sentToAI: result.sanitizedPayload,
      };
    } catch (err) {
      if (err instanceof GeminiError) throw new ApiError(err.status, err.message, "gemini");
      throw err;
    }
  });
}
