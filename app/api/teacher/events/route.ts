import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { DEFAULT_GUIDANCE } from "@/lib/events/defaults";
import { computeEventPhase } from "@/lib/events/phase";
import { isValidIsoDate, todayInKST } from "@/lib/utils";
import type { Category, EventDoc, EventStatus, ResponseDoc } from "@/lib/types";

interface CreateBody {
  category?: string;
  title?: string;
  description?: string;
  guidance?: string;
  eventDate?: string;
  status?: string;
}

const CATEGORIES: Category[] = ["autonomous", "career"];
const STATUSES: EventStatus[] = ["scheduled", "open", "closed"];

/** 교사용 활동 목록. 학생 제출 수를 함께 내려 진행 상황을 볼 수 있게 한다. */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const db = adminDb();

    const [eventSnap, responseSnap, rosterSnap] = await Promise.all([
      db.collection(COL.events).where("classId", "==", ctx.classId).get(),
      db.collection(COL.responses).where("classId", "==", ctx.classId).get(),
      db.collection(COL.roster).where("classId", "==", ctx.classId).get(),
    ]);

    const submitted = new Map<string, number>();
    responseSnap.forEach((d) => {
      const r = d.data() as ResponseDoc;
      if (!r.content?.trim()) return;
      submitted.set(r.eventId, (submitted.get(r.eventId) ?? 0) + 1);
    });

    const today = todayInKST();
    const events = eventSnap.docs
      .map((d) => d.data() as EventDoc)
      .sort((a, b) => (a.eventDate === b.eventDate ? b.createdAt - a.createdAt : b.eventDate.localeCompare(a.eventDate)))
      .map((e) => ({
        ...e,
        submittedCount: submitted.get(e.eventId) ?? 0,
        // 학생 입장에서 지금 어떤 상태로 보이는지 (개인 제출 여부는 제외)
        phase: computeEventPhase(e.status, e.eventDate, today, false),
      }));

    return { events, studentCount: rosterSnap.size, today };
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const body = await readJson<CreateBody>(req);

    const category = body.category as Category;
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const guidance = (body.guidance ?? "").trim() || DEFAULT_GUIDANCE;
    const eventDate = (body.eventDate ?? "").trim();
    const status = (body.status as EventStatus) ?? "scheduled";

    if (!CATEGORIES.includes(category)) throw badRequest("활동 영역을 선택해주세요.");
    if (!title) throw badRequest("활동명을 입력해주세요.");
    if (!isValidIsoDate(eventDate)) throw badRequest("활동 날짜를 올바르게 입력해주세요.");
    if (!STATUSES.includes(status)) throw badRequest("활동 상태 값이 올바르지 않습니다.");

    const db = adminDb();
    const ref = db.collection(COL.events).doc();
    const now = Date.now();
    const doc: EventDoc = {
      eventId: ref.id,
      classId: ctx.classId,
      category,
      title,
      description,
      guidance,
      eventDate,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };
    await ref.set(doc);
    return { event: doc };
  });
}
