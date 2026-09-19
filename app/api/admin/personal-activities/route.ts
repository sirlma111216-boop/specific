import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireStaff } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { commitInChunks } from "@/lib/firebase/batch";
import { addReads } from "@/lib/firebase/read-meter";
import {
  formatActivityPeriod,
  MAX_ACTIVITY_CONTENT_LENGTH,
  MAX_ACTIVITY_TARGETS,
  MAX_ACTIVITY_TITLE_LENGTH,
  sortPersonalActivities,
  type PersonalActivityItem,
} from "@/lib/activities/personal";
import { countCharacters, isValidIsoDate } from "@/lib/utils";
import type { PersonalActivityDoc, RosterDoc } from "@/lib/types";

interface CreateBody {
  rosterIds?: string[];
  title?: string;
  content?: string;
  startDate?: string;
  endDate?: string;
}

/** 한 학생의 개인 활동 기록 목록. (활동 입력 화면에서 고치거나 지울 때 쓴다) */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireStaff(req);
    const rosterId = (new URL(req.url).searchParams.get("rosterId") ?? "").trim();
    if (!rosterId) throw badRequest("학생을 선택해주세요.");

    const snap = await adminDb()
      .collection(COL.personalActivities)
      .where("rosterId", "==", rosterId)
      .get();
    addReads(snap.size);

    const items: PersonalActivityItem[] = sortPersonalActivities(
      snap.docs.map((d) => d.data() as PersonalActivityDoc),
    ).map((a) => ({
      activityId: a.activityId,
      rosterId: a.rosterId,
      title: a.title,
      content: a.content,
      startDate: a.startDate,
      endDate: a.endDate,
      period: formatActivityPeriod(a.startDate, a.endDate),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      // 입력한 본인만 고치고 지운다. 슈퍼관리자는 모든 자료를 정리할 수 있다.
      mine: a.createdBy === ctx.uid || ctx.role === "admin",
    }));

    return { items };
  });
}

/**
 * 고른 학생들에게 같은 활동 기록을 한 번에 남긴다.
 * 도서관 행사처럼 여러 반 학생이 섞여 참여한 활동을 한 번에 넣기 위한 화면이라,
 * 학생마다 문서를 따로 만든다. (담임 화면은 학생 단위로 읽는다)
 */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireStaff(req);
    const body = await readJson<CreateBody>(req);

    const rosterIds = Array.from(
      new Set((Array.isArray(body.rosterIds) ? body.rosterIds : []).map((id) => id.trim()).filter(Boolean)),
    );
    const title = (body.title ?? "").trim();
    const content = (body.content ?? "").trim();
    const startDate = (body.startDate ?? "").trim();
    const endDate = (body.endDate ?? "").trim() || startDate;

    if (rosterIds.length === 0) throw badRequest("학생을 한 명 이상 선택해주세요.");
    if (rosterIds.length > MAX_ACTIVITY_TARGETS) {
      throw badRequest(`한 번에 ${MAX_ACTIVITY_TARGETS}명까지 기록할 수 있습니다.`);
    }
    if (!title) throw badRequest("활동명을 입력해주세요.");
    if (countCharacters(title) > MAX_ACTIVITY_TITLE_LENGTH) {
      throw badRequest(`활동명은 ${MAX_ACTIVITY_TITLE_LENGTH}자 이내로 입력해주세요.`);
    }
    if (!content) throw badRequest("활동 내용을 입력해주세요.");
    if (countCharacters(content) > MAX_ACTIVITY_CONTENT_LENGTH) {
      throw badRequest(`활동 내용은 ${MAX_ACTIVITY_CONTENT_LENGTH}자 이내로 입력해주세요.`);
    }
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      throw badRequest("활동 일자를 올바르게 입력해주세요.");
    }
    if (startDate > endDate) throw badRequest("시작일이 종료일보다 늦습니다.");

    const db = adminDb();
    // 학생마다 문서를 한 번씩 읽지 않도록, 고른 학생의 명단 문서만 모아서 읽는다.
    const refs = rosterIds.map((id) => db.collection(COL.roster).doc(id));
    const snaps = await db.getAll(...refs);
    addReads(snaps.length);

    const now = Date.now();
    const docs: PersonalActivityDoc[] = [];
    for (const snap of snaps) {
      if (!snap.exists) throw notFound("명단에 없는 학생이 있습니다. 목록을 새로 고친 뒤 다시 해주세요.");
      const roster = snap.data() as RosterDoc;
      const ref = db.collection(COL.personalActivities).doc();
      docs.push({
        activityId: ref.id,
        rosterId: roster.rosterId,
        classId: roster.classId,
        title,
        content,
        startDate,
        endDate,
        createdBy: ctx.uid,
        createdAt: now,
        updatedAt: now,
      });
    }

    await commitInChunks(
      docs.map((doc) => (b: FirebaseFirestore.WriteBatch) =>
        b.set(db.collection(COL.personalActivities).doc(doc.activityId), doc),
      ),
    );

    return { ok: true, saved: docs.length };
  });
}
