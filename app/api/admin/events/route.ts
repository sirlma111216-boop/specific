import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest } from "@/lib/api-error";
import { requireStaff } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { DEFAULT_GUIDANCE } from "@/lib/events/defaults";
import { computeEventPhase, openUntilFor } from "@/lib/events/phase";
import { safeCount } from "@/lib/events/counters";
import { invalidateEvents, loadAllEvents } from "@/lib/events/load";
import { loadAllClasses } from "@/lib/admin/lookup";
import { defaultForm, resolveForm } from "@/lib/forms/schema";
import { isValidIsoDate, todayInKST } from "@/lib/utils";
import type { Category, EventDoc, EventStatus } from "@/lib/types";

interface CreateBody {
  category?: string;
  title?: string;
  description?: string;
  guidance?: string;
  eventDate?: string;
  status?: string;
  isTest?: boolean;
}

const CATEGORIES: Category[] = ["autonomous", "career"];
const STATUSES: EventStatus[] = ["scheduled", "open", "closed"];

/** 관리자용 활동 목록. 활동은 학교 전체 공통이라 학급으로 나누지 않는다. */
export async function GET(req: Request) {
  return route(async () => {
    await requireStaff(req);

    const [events, classMap] = await Promise.all([loadAllEvents(), loadAllClasses()]);

    // 전교생 수는 학급 문서의 인원수를 더해 구한다. (명단을 훑지 않는다)
    let studentCount = 0;
    let classCount = 0;
    for (const c of classMap.values()) {
      if (c.isTest) continue;
      classCount += 1;
      studentCount += safeCount(c.studentCount);
    }

    const today = todayInKST();
    const eventList = events
      .slice()
      .sort((a, b) =>
        a.eventDate === b.eventDate ? b.createdAt - a.createdAt : b.eventDate.localeCompare(a.eventDate),
      )
      .map((e) => ({
        ...e,
        submittedCount: safeCount(e.submittedCount),
        questionCount: resolveForm(e.form).length,
        phase: computeEventPhase(e.status, e.eventDate, today, false, e.openUntil),
      }));

    return { events: eventList, studentCount, classCount, today };
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireStaff(req);
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
      category,
      title,
      description,
      guidance,
      eventDate,
      status,
      // '지금 공개'로 만들어도 기한을 둔다. 날짜가 지나면 저절로 마감된다.
      ...(status === "open" ? { openUntil: openUntilFor(eventDate, todayInKST()) } : {}),
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
      submittedCount: 0,
      // 양식을 따로 만들지 않아도 바로 쓸 수 있도록 자유 서술 한 칸으로 시작한다.
      form: defaultForm(),
      // 연수용 테스트 활동은 테스트 계정에게만 보인다.
      ...(body.isTest ? { isTest: true } : {}),
    };
    await ref.set(doc);
    invalidateEvents();
    return { event: doc };
  });
}
