import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { commitInChunks } from "@/lib/firebase/batch";
import type { ClassDoc, ResponseDoc, RosterDoc, UserDoc } from "@/lib/types";

/**
 * 삭제 연쇄. 교사 화면과 관리자 화면이 같은 규칙으로 지우도록 여기 한 곳에 둔다.
 *
 * 원칙: 문서 하나만 지우고 끝내면 주인 없는 자료와 어긋난 카운터가 남는다.
 *  · 학생 → 소감·교사 기록·특기사항, 활동별 제출 인원, 학급 인원수, 계정
 *  · 학급 → 학생 전원, 학급 문서, 담임 계정의 학급 연결
 *  · 계정 → 학생이면 명단 연결만 풀고(기록은 남긴다), 교사면 계정만
 */

export interface RosterDeletion {
  removedAccount: boolean;
  deletedResponses: number;
  deletedNotes: number;
  deletedRecords: number;
}

export async function deleteRosterEntry(rosterId: string): Promise<RosterDeletion> {
  const db = adminDb();
  const ref = db.collection(COL.roster).doc(rosterId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { removedAccount: false, deletedResponses: 0, deletedNotes: 0, deletedRecords: 0 };
  }
  const roster = snap.data() as RosterDoc;

  const [responses, notes, records] = await Promise.all([
    db.collection(COL.responses).where("rosterId", "==", rosterId).get(),
    db.collection(COL.notes).where("rosterId", "==", rosterId).get(),
    db.collection(COL.records).where("rosterId", "==", rosterId).get(),
  ]);

  const ops: Array<(b: FirebaseFirestore.WriteBatch) => void> = [];
  responses.forEach((d) => {
    const r = d.data() as ResponseDoc;
    ops.push((b) => b.delete(d.ref));
    // 활동별 제출 인원에서도 빼야 관리자 화면의 "N/25명 작성"이 맞는다.
    if (r.content?.trim()) {
      ops.push((b) =>
        b.update(db.collection(COL.events).doc(r.eventId), {
          submittedCount: FieldValue.increment(-1),
        }),
      );
    }
  });
  notes.forEach((d) => ops.push((b) => b.delete(d.ref)));
  records.forEach((d) => ops.push((b) => b.delete(d.ref)));
  ops.push((b) => b.delete(ref));
  ops.push((b) =>
    b.update(db.collection(COL.classes).doc(roster.classId), {
      studentCount: FieldValue.increment(-1),
    }),
  );
  await commitInChunks(ops);

  // 계정이 연결돼 있었다면 함께 지운다. 남겨두면 명단 없는 계정으로 로그인해
  // 활동에 계속 답할 수 있다. 다른 학생의 계정을 잘못 지우지 않도록 연결 관계를 확인한다.
  let removedAccount = false;
  if (roster.linkedUserId) {
    const userRef = db.collection(COL.users).doc(roster.linkedUserId);
    const userSnap = await userRef.get();
    if (userSnap.exists && (userSnap.data() as UserDoc).rosterId === rosterId) {
      await userRef.delete();
      await adminAuth().deleteUser(roster.linkedUserId).catch(() => {});
      removedAccount = true;
    }
  }

  return {
    removedAccount,
    deletedResponses: responses.size,
    deletedNotes: notes.size,
    deletedRecords: records.size,
  };
}

export interface ClassDeletion {
  deletedStudents: number;
  removedAccounts: number;
  teacherUnlinked: boolean;
}

export async function deleteClass(classId: string): Promise<ClassDeletion> {
  const db = adminDb();
  const ref = db.collection(COL.classes).doc(classId);
  const snap = await ref.get();
  if (!snap.exists) return { deletedStudents: 0, removedAccounts: 0, teacherUnlinked: false };
  const klass = snap.data() as ClassDoc;

  const roster = await db.collection(COL.roster).where("classId", "==", classId).get();
  let removedAccounts = 0;
  for (const d of roster.docs) {
    const r = await deleteRosterEntry(d.id);
    if (r.removedAccount) removedAccounts++;
  }

  // 담임 계정은 남기고 학급 연결만 푼다. 다시 학급을 만들 수 있어야 한다.
  let teacherUnlinked = false;
  if (klass.teacherId) {
    const userRef = db.collection(COL.users).doc(klass.teacherId);
    const userSnap = await userRef.get();
    if (userSnap.exists && (userSnap.data() as UserDoc).classId === classId) {
      await userRef.update({ classId: null });
      teacherUnlinked = true;
    }
  }

  await ref.delete();
  return { deletedStudents: roster.size, removedAccounts, teacherUnlinked };
}

export interface AccountDeletion {
  role: UserDoc["role"];
  rosterUnlinked: boolean;
}

/**
 * 계정만 지운다. 학생은 명단 행을 '미가입'으로 되돌려 다시 가입할 수 있게 하고,
 * 소감·기록은 명단에 딸린 자료이므로 그대로 둔다. (비밀번호를 잊어 계정을 새로 만드는 경우)
 */
export async function deleteAccount(uid: string): Promise<AccountDeletion> {
  const db = adminDb();
  const userRef = db.collection(COL.users).doc(uid);
  const snap = await userRef.get();
  const user = snap.data() as UserDoc | undefined;

  let rosterUnlinked = false;
  if (user?.role === "student" && user.rosterId) {
    const rosterRef = db.collection(COL.roster).doc(user.rosterId);
    const rosterSnap = await rosterRef.get();
    if (rosterSnap.exists && (rosterSnap.data() as RosterDoc).linkedUserId === uid) {
      await rosterRef.update({ signupStatus: "pending", linkedUserId: null });
      rosterUnlinked = true;
    }
  }

  if (snap.exists) await userRef.delete();
  await adminAuth().deleteUser(uid).catch(() => {});
  return { role: user?.role ?? "student", rosterUnlinked };
}
