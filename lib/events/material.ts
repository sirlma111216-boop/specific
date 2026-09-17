import "server-only";

import { adminDb, COL } from "@/lib/firebase/admin";
import type { ResponseDoc, TeacherNoteDoc } from "@/lib/types";

/**
 * 한 활동에 "쓸 기록이 있는" 학생(rosterId)들.
 *
 * 학생 원문(responses)이든 교사 보완본(teacherNotes)이든 하나라도 내용이 있으면 포함한다.
 * 학생별 자율/진로 기록 수 카운터는 이 기준으로 1씩 세어져 있으므로,
 * 활동을 지우거나 영역을 바꿀 때 이 집합만큼 카운터를 옮겨야 실제와 맞는다.
 */
export async function rostersWithMaterialFor(eventId: string): Promise<{
  rosterIds: Set<string>;
  responses: FirebaseFirestore.QuerySnapshot;
  notes: FirebaseFirestore.QuerySnapshot;
}> {
  const db = adminDb();
  const [responses, notes] = await Promise.all([
    db.collection(COL.responses).where("eventId", "==", eventId).get(),
    db.collection(COL.notes).where("eventId", "==", eventId).get(),
  ]);
  const rosterIds = new Set<string>();
  responses.forEach((d) => {
    const r = d.data() as ResponseDoc;
    if (r.content?.trim()) rosterIds.add(r.rosterId);
  });
  notes.forEach((d) => {
    const n = d.data() as TeacherNoteDoc;
    if (n.content?.trim()) rosterIds.add(n.rosterId);
  });
  return { rosterIds, responses, notes };
}
