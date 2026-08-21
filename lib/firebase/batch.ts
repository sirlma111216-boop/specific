import "server-only";

import type { WriteBatch } from "firebase-admin/firestore";
import { adminDb } from "./admin";

/**
 * Firestore 배치는 한 번에 500개까지만 쓸 수 있다.
 * 학생 한 명이나 활동 하나에 딸린 자료가 그보다 많을 수 있어 나눠서 커밋한다.
 */
export async function commitInChunks(
  ops: Array<(batch: WriteBatch) => void>,
  size = 400,
): Promise<void> {
  if (ops.length === 0) return;
  const db = adminDb();
  for (let i = 0; i < ops.length; i += size) {
    const batch = db.batch();
    ops.slice(i, i + size).forEach((op) => op(batch));
    await batch.commit();
  }
}
