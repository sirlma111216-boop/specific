import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import {
  isChoiceType,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  resolveForm,
  validateForm,
  type FormQuestion,
  type QuestionType,
} from "@/lib/forms/schema";
import { isValidIsoDate } from "@/lib/utils";
import type { EventDoc, EventStatus } from "@/lib/types";

interface PatchBody {
  title?: string;
  description?: string;
  guidance?: string;
  eventDate?: string;
  status?: string;
  form?: unknown;
}

const STATUSES: EventStatus[] = ["scheduled", "open", "closed"];
const TYPES: QuestionType[] = ["short", "long", "single", "multiple"];

async function loadEvent(eventId: string) {
  const ref = adminDb().collection(COL.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("활동을 찾을 수 없습니다.");
  return { ref, event: snap.data() as EventDoc };
}

/** 클라이언트가 보낸 양식을 신뢰하지 않고 서버에서 다시 만든다. */
function sanitizeForm(raw: unknown): FormQuestion[] {
  if (!Array.isArray(raw)) throw badRequest("양식 형식이 올바르지 않습니다.");
  if (raw.length > MAX_QUESTIONS) {
    throw badRequest(`질문은 최대 ${MAX_QUESTIONS}개까지 만들 수 있습니다.`);
  }

  const questions: FormQuestion[] = raw.map((item, i) => {
    const q = (item ?? {}) as Partial<FormQuestion>;
    const type = TYPES.includes(q.type as QuestionType) ? (q.type as QuestionType) : "long";
    const id = String(q.id ?? "").trim() || `q${i + 1}`;
    const options = isChoiceType(type)
      ? (Array.isArray(q.options) ? q.options : [])
          .map((o) => String(o).trim())
          .filter(Boolean)
          .slice(0, MAX_OPTIONS)
      : [];
    return {
      id,
      type,
      label: String(q.label ?? "").trim(),
      required: Boolean(q.required),
      options,
    };
  });

  const errors = validateForm(questions);
  if (errors.length > 0) throw badRequest(errors.join("\n"), "form_invalid");
  return questions;
}

/** 활동 수정 · 양식 저장 · 지금 공개 · 마감 · 다시 열기 */
export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { eventId } = await params;
    const { ref } = await loadEvent(eventId);
    const body = await readJson<PatchBody>(req);

    const update: Partial<EventDoc> = { updatedAt: Date.now() };

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) throw badRequest("활동명을 입력해주세요.");
      update.title = title;
    }
    if (body.description !== undefined) update.description = body.description.trim();
    if (body.guidance !== undefined) update.guidance = body.guidance.trim();
    if (body.eventDate !== undefined) {
      if (!isValidIsoDate(body.eventDate)) throw badRequest("활동 날짜를 올바르게 입력해주세요.");
      update.eventDate = body.eventDate;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as EventStatus)) {
        throw badRequest("활동 상태 값이 올바르지 않습니다.");
      }
      update.status = body.status as EventStatus;
    }
    if (body.form !== undefined) {
      update.form = sanitizeForm(body.form);
    }

    await ref.update(update);
    const fresh = await ref.get();
    const event = fresh.data() as EventDoc;
    return { event: { ...event, form: resolveForm(event.form) } };
  });
}

/** 학생 응답이 하나라도 있으면 삭제하지 않는다. */
export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { eventId } = await params;
    const { ref } = await loadEvent(eventId);

    const [responses, notes] = await Promise.all([
      adminDb().collection(COL.responses).where("eventId", "==", eventId).limit(1).get(),
      adminDb().collection(COL.notes).where("eventId", "==", eventId).limit(1).get(),
    ]);
    if (!responses.empty || !notes.empty) {
      throw badRequest(
        "기록이 있는 활동은 삭제할 수 없습니다. 필요하면 마감 처리해주세요.",
        "has_responses",
      );
    }

    await ref.delete();
    return { ok: true };
  });
}
