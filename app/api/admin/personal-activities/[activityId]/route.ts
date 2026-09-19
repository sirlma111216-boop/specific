import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, forbidden, notFound } from "@/lib/api-error";
import { requireStaff } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import {
  MAX_ACTIVITY_CONTENT_LENGTH,
  MAX_ACTIVITY_TITLE_LENGTH,
} from "@/lib/activities/personal";
import { countCharacters, isValidIsoDate } from "@/lib/utils";
import type { AuthContext } from "@/lib/auth/server";
import type { PersonalActivityDoc } from "@/lib/types";

interface PatchBody {
  title?: string;
  content?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 개인 활동 기록은 입력한 사람만 고치고 지운다.
 * 담임과 학생은 손대지 못한다 — 담임은 이 기록으로 만든 특기사항을 직접 고칠 책임이 있고,
 * 원본 기록은 담당 교사의 것이기 때문이다. (슈퍼관리자는 모든 자료를 정리할 수 있다)
 */
async function loadOwn(req: Request, activityId: string) {
  const ctx: AuthContext = await requireStaff(req);
  const ref = adminDb().collection(COL.personalActivities).doc(activityId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("기록을 찾을 수 없습니다.");
  const activity = snap.data() as PersonalActivityDoc;
  if (activity.createdBy !== ctx.uid && ctx.role !== "admin") {
    throw forbidden("이 기록을 입력한 선생님만 고치거나 지울 수 있습니다.");
  }
  return { ref, activity };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ activityId: string }> }) {
  return route(async () => {
    const { activityId } = await params;
    const { ref, activity } = await loadOwn(req, activityId);
    const body = await readJson<PatchBody>(req);

    const update: Partial<PersonalActivityDoc> = { updatedAt: Date.now() };

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) throw badRequest("활동명을 입력해주세요.");
      if (countCharacters(title) > MAX_ACTIVITY_TITLE_LENGTH) {
        throw badRequest(`활동명은 ${MAX_ACTIVITY_TITLE_LENGTH}자 이내로 입력해주세요.`);
      }
      update.title = title;
    }
    if (body.content !== undefined) {
      const content = body.content.trim();
      if (!content) throw badRequest("활동 내용을 입력해주세요.");
      if (countCharacters(content) > MAX_ACTIVITY_CONTENT_LENGTH) {
        throw badRequest(`활동 내용은 ${MAX_ACTIVITY_CONTENT_LENGTH}자 이내로 입력해주세요.`);
      }
      update.content = content;
    }
    if (body.startDate !== undefined) {
      if (!isValidIsoDate(body.startDate)) throw badRequest("활동 일자를 올바르게 입력해주세요.");
      update.startDate = body.startDate;
    }
    if (body.endDate !== undefined) {
      if (!isValidIsoDate(body.endDate)) throw badRequest("활동 일자를 올바르게 입력해주세요.");
      update.endDate = body.endDate;
    }

    const start = update.startDate ?? activity.startDate;
    const end = update.endDate ?? activity.endDate;
    if (start > end) throw badRequest("시작일이 종료일보다 늦습니다.");

    await ref.update(update);
    return { ok: true, activity: { ...activity, ...update } };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ activityId: string }> }) {
  return route(async () => {
    const { activityId } = await params;
    const { ref } = await loadOwn(req, activityId);
    await ref.delete();
    return { ok: true };
  });
}
