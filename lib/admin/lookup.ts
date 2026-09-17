import "server-only";

import { adminDb, COL } from "@/lib/firebase/admin";
import { normalizeGradeOrClass } from "@/lib/roster/normalize";
import { cached } from "@/lib/server-cache";
import { addReads } from "@/lib/firebase/read-meter";

/** 관리자 화면 캐시 수명. 관리자가 무언가를 바꾸면 그 자리에서 지워지므로 길어도 된다. */
const ADMIN_TTL_MS = 10 * 60 * 1000;
import type { ClassDoc, RosterDoc, UserDoc } from "@/lib/types";

/**
 * 학급 정렬: 실제 → 테스트, 최신 학년도, 학년·반 숫자 순.
 * 교사가 "1"이라고도 "1학년"이라고도 적어 두었으므로 정규화한 값으로 비교한다.
 */
export function sortClassSummaries<T extends { isTest: boolean; schoolYear: number; grade: string; classNumber: string }>(
  list: T[],
): T[] {
  const num = (v: string) => {
    const n = Number(normalizeGradeOrClass(v));
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  return [...list].sort(
    (a, b) =>
      Number(a.isTest) - Number(b.isTest) ||
      b.schoolYear - a.schoolYear ||
      num(a.grade) - num(b.grade) ||
      num(a.classNumber) - num(b.classNumber) ||
      a.grade.localeCompare(b.grade, "ko"),
  );
}

/** 관리자 화면이 같이 쓰는 조회 도우미. 한 번 읽어 Map으로 들고 다닌다. */

export function loadAllUsers(): Promise<Map<string, UserDoc>> {
  return cached("admin:users", ADMIN_TTL_MS, async () => {
    const snap = await adminDb().collection(COL.users).get();
    addReads(snap.size);
    const map = new Map<string, UserDoc>();
    snap.forEach((d) => map.set(d.id, d.data() as UserDoc));
    return map;
  });
}

export function loadAllClasses(): Promise<Map<string, ClassDoc>> {
  return cached("admin:classes", ADMIN_TTL_MS, async () => {
    const snap = await adminDb().collection(COL.classes).get();
    addReads(snap.size);
    const map = new Map<string, ClassDoc>();
    snap.forEach((d) => map.set(d.id, d.data() as ClassDoc));
    return map;
  });
}

export function loadAllRoster(): Promise<Map<string, RosterDoc>> {
  return cached("admin:roster", ADMIN_TTL_MS, async () => {
    const snap = await adminDb().collection(COL.roster).get();
    addReads(snap.size);
    const map = new Map<string, RosterDoc>();
    snap.forEach((d) => map.set(d.id, d.data() as RosterDoc));
    return map;
  });
}

/** 화면에 보여줄 학급 한 줄 요약 */
export interface ClassSummary {
  classId: string;
  schoolYear: number;
  grade: string;
  classNumber: string;
  teacherName: string;
  teacherId: string;
  teacherEmail: string | null;
  /** 담임 계정이 없거나, 그 계정이 이 학급을 가리키지 않는다 */
  teacherMissing: boolean;
  studentCount: number;
  linkedCount: number;
  isTest: boolean;
  createdAt: number;
}

export function summarizeClass(
  klass: ClassDoc,
  users: Map<string, UserDoc>,
  roster: RosterDoc[],
): ClassSummary {
  const teacher = users.get(klass.teacherId);
  return {
    classId: klass.classId,
    schoolYear: klass.schoolYear,
    grade: klass.grade,
    classNumber: klass.classNumber,
    teacherName: klass.teacherName,
    teacherId: klass.teacherId,
    teacherEmail: teacher?.email ?? null,
    teacherMissing: !teacher || teacher.role !== "teacher" || teacher.classId !== klass.classId,
    studentCount: roster.length,
    linkedCount: roster.filter((r) => r.signupStatus === "linked" && r.linkedUserId).length,
    isTest: Boolean(klass.isTest),
    createdAt: klass.createdAt,
  };
}

/** 계정 한 줄 요약. 어긋난 계정은 이유를 함께 담는다. */
export interface AccountSummary {
  uid: string;
  role: UserDoc["role"];
  email: string;
  createdAt: number;
  isTest: boolean;
  classId: string | null;
  classLabel: string | null;
  teacherName?: string;
  rosterId?: string | null;
  studentNumber?: number;
  studentName?: string;
  /** 비어 있으면 정상. 아니면 어긋난 이유 */
  problem: string | null;
}

export function summarizeAccount(
  uid: string,
  user: UserDoc,
  classes: Map<string, ClassDoc>,
  roster: Map<string, RosterDoc>,
  classLabel: (c: ClassDoc) => string,
): AccountSummary {
  const klass = user.classId ? classes.get(user.classId) : undefined;
  const base: AccountSummary = {
    uid,
    role: user.role,
    email: user.email,
    createdAt: user.createdAt,
    isTest: Boolean(user.isTest),
    classId: user.classId ?? null,
    classLabel: klass ? classLabel(klass) : null,
    problem: null,
  };

  // 슈퍼관리자·일정 관리자는 학급·명단과 무관하다.
  if (user.role === "admin" || user.role === "scheduler") return base;

  if (user.role === "teacher") {
    base.teacherName = user.teacherName;
    if (!user.classId) base.problem = "학급 미등록";
    else if (!klass) base.problem = "연결된 학급이 삭제됨";
    else if (klass.teacherId !== uid) base.problem = "학급의 담임이 다른 계정";
    return base;
  }

  // student
  base.rosterId = user.rosterId ?? null;
  const entry = user.rosterId ? roster.get(user.rosterId) : undefined;
  if (!user.rosterId) base.problem = "명단과 연결되지 않음";
  else if (!entry) base.problem = "연결된 명단 행이 삭제됨";
  else {
    base.studentNumber = entry.studentNumber;
    base.studentName = entry.studentName;
    if (entry.linkedUserId !== uid) base.problem = "명단 행이 다른 계정을 가리킴";
    else if (entry.classId !== user.classId) base.problem = "명단의 학급과 계정의 학급이 다름";
  }
  return base;
}
