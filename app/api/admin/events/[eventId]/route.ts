import { FieldValue } from "firebase-admin/firestore";
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
import { rosterCountField } from "@/lib/events/counters";
import { isValidIsoDate } from "@/lib/utils";
import type { EventDoc, EventStatus, ResponseDoc, TeacherNoteDoc } from "@/lib/types";

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

/** Firestore 배치 한도(500)를 넘지 않게 나눠서 커밋한다. */
async function commitInChunks(
  ops: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
  size = 400,
) {
  const db = adminDb();
  for (let i = 0; i < ops.length; i += size) {
    const batch = db.batch();
    ops.slice(i, i + size).forEach((op) => op(batch));
    await batch.commit();
  }
}

/**
 * 활동 삭제. 관리자는 학생 응답이 있어도 지울 수 있다.
 *
 * 그냥 활동만 지우면 학생 응답·교사 보완본이 주인 없이 남고,
 * 학생별 기록 수 카운터가 실제와 어긋난다. 그래서 딸린 자료를 함께 정리한다.
 * 되돌릴 수 없으므로 화면에서 삭제될 응답 수를 알리고 확인을 받는다.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { eventId } = await params;
    const { ref, event } = await loadEvent(eventId);
    const db = adminDb();

    const [responses, notes] = await Promise.all([
      db.collection(COL.responses).where("eventId", "==", eventId).get(),
      db.collection(COL.notes).where("eventId", "==", eventId).get(),
    ]);

    // 이 활동에 "쓸 기록이 있던" 학생만 카운터를 1 내린다.
    // 학생 원문과 교사 보완본이 둘 다 있어도 카운터에는 1로 세어져 있다.
    const rostersWithMaterial = new Set<string>();
    responses.forEach((d) => {
      const r = d.data() as ResponseDoc;
      if (r.content?.trim()) rostersWithMaterial.add(r.rosterId);
    });
    notes.forEach((d) => {
      const n = d.data() as TeacherNoteDoc;
      if (n.content?.trim()) rostersWithMaterial.add(n.rosterId);
    });

    const countField = rosterCountField(event.category);
    const ops: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    responses.forEach((d) => ops.push((b) => b.delete(d.ref)));
    notes.forEach((d) => ops.push((b) => b.delete(d.ref)));
    for (const rosterId of rostersWithMaterial) {
      ops.push((b) =>
        b.update(db.collection(COL.roster).doc(rosterId), {
          [countField]: FieldValue.increment(-1),
        }),
      );
    }
    ops.push((b) => b.delete(ref));

    await commitInChunks(ops);

    return {
      ok: true,
      deletedResponses: responses.size,
      deletedNotes: notes.size,
      affectedStudents: rostersWithMaterial.size,
    };
  });
}
