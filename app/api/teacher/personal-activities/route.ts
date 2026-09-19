import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";
import { addReads } from "@/lib/firebase/read-meter";
import {
  formatActivityPeriod,
  sortPersonalActivities,
  type PersonalActivityItem,
} from "@/lib/activities/personal";
import type { PersonalActivityDoc, RosterDoc } from "@/lib/types";

/**
 * 담임이 '기록 불러오기'로 가져오는, 담당 교사가 따로 남긴 개인 활동.
 *
 * 학생 상세 화면을 열 때마다 읽지 않고 버튼을 눌렀을 때만 읽는다.
 * 담임은 읽기만 한다 — 고치고 지우는 것은 기록을 남긴 담당 교사의 몫이다.
 */
export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const rosterId = (new URL(req.url).searchParams.get("rosterId") ?? "").trim();
    if (!rosterId) throw badRequest("학생을 선택해주세요.");

    const db = adminDb();
    const rosterSnap = await db.collection(COL.roster).doc(rosterId).get();
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    if ((rosterSnap.data() as RosterDoc).classId !== ctx.classId) {
      throw notFound("학생을 찾을 수 없습니다.");
    }

    const snap = await db
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
    }));

    return { items };
  });
}
