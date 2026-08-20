import { adminDb, COL, recordId } from "@/lib/firebase/admin";
import { badRequest, notFound } from "@/lib/api-error";
import { requireTeacherWithClass } from "@/lib/auth/server";
import { readJson, route } from "@/lib/route-helpers";
import { countCharacters } from "@/lib/utils";
import type { Category, RosterDoc, SelectionMode, StudentRecordDoc } from "@/lib/types";

interface Body {
  rosterId?: string;
  category?: string;
  selectedEventIds?: string[];
  selectionOrder?: Record<string, number>;
  selectionMode?: string;
  usedEventIds?: string[];
  targetLength?: number;
  generatedText?: string;
  editedText?: string;
}

const CATEGORIES: Category[] = ["autonomous", "career"];

/**
 * 교사가 검토·수정한 특기사항 저장.
 * 이 컬렉션은 보안 규칙상 학생이 읽을 수 없다.
 */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireTeacherWithClass(req);
    const body = await readJson<Body>(req);

    const rosterId = (body.rosterId ?? "").trim();
    const category = body.category as Category;
    const editedText = (body.editedText ?? "").trim();
    const generatedText = (body.generatedText ?? "").trim();

    if (!rosterId) throw badRequest("학생을 선택해주세요.");
    if (!CATEGORIES.includes(category)) throw badRequest("활동 영역을 선택해주세요.");
    if (!editedText) throw badRequest("저장할 내용이 없습니다.");

    const db = adminDb();
    const rosterSnap = await db.collection(COL.roster).doc(rosterId).get();
    if (!rosterSnap.exists) throw notFound("학생을 찾을 수 없습니다.");
    const roster = rosterSnap.data() as RosterDoc;
    if (roster.classId !== ctx.classId) throw notFound("학생을 찾을 수 없습니다.");

    const id = recordId(rosterId, category);
    const ref = db.collection(COL.records).doc(id);
    const existing = await ref.get();
    const now = Date.now();

    const doc: StudentRecordDoc = {
      recordId: id,
      classId: ctx.classId,
      rosterId,
      studentId: roster.linkedUserId ?? "",
      teacherId: ctx.uid,
      category,
      selectedEventIds: body.selectedEventIds ?? [],
      selectionOrder: body.selectionOrder ?? {},
      selectionMode: (body.selectionMode as SelectionMode) ?? "priority",
      usedEventIds: body.usedEventIds ?? [],
      targetLength: Number(body.targetLength) || 0,
      generatedText,
      editedText,
      generatedCharacterCount: countCharacters(generatedText),
      finalCharacterCount: countCharacters(editedText),
      createdAt: (existing.data() as StudentRecordDoc | undefined)?.createdAt ?? now,
      updatedAt: now,
    };
    await ref.set(doc);

    return { record: doc };
  });
}
