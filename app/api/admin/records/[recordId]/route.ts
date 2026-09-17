import { adminDb, COL } from "@/lib/firebase/admin";
import { notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { route } from "@/lib/route-helpers";

/** 저장된 특기사항 삭제. 카운터와 무관한 문서라 그냥 지운다. */
export async function DELETE(req: Request, { params }: { params: Promise<{ recordId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { recordId } = await params;
    const ref = adminDb().collection(COL.records).doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("특기사항을 찾을 수 없습니다.");
    await ref.delete();
    return { ok: true };
  });
}
