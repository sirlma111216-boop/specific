import { adminDb, COL } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { countCharacters } from "@/lib/utils";
import type { StudentRecordDoc } from "@/lib/types";

interface PatchBody {
  editedText?: string;
}

async function load(recordId: string) {
  const ref = adminDb().collection(COL.records).doc(recordId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("특기사항을 찾을 수 없습니다.");
  return { ref, record: snap.data() as StudentRecordDoc };
}

/** 저장된 특기사항 본문 수정. 생성 원문(generatedText)은 남겨 두고 교사 수정본만 바꾼다. */
export async function PATCH(req: Request, { params }: { params: Promise<{ recordId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { recordId } = await params;
    const body = await readJson<PatchBody>(req);
    const editedText = (body.editedText ?? "").trim();
    if (!editedText) throw badRequest("내용을 입력해주세요. 비우려면 삭제를 쓰세요.");

    const { ref } = await load(recordId);
    const now = Date.now();
    await ref.update({ editedText, finalCharacterCount: countCharacters(editedText), updatedAt: now });
    return { ok: true, finalCharacterCount: countCharacters(editedText), updatedAt: now };
  });
}

/** 저장된 특기사항 삭제. 카운터와 무관한 문서라 그냥 지운다. */
export async function DELETE(req: Request, { params }: { params: Promise<{ recordId: string }> }) {
  return route(async () => {
    await requireAdmin(req);
    const { recordId } = await params;
    const { ref } = await load(recordId);
    await ref.delete();
    return { ok: true };
  });
}
