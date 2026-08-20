import "server-only";

import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { forbidden, unauthorized } from "@/lib/api-error";
import type { Role, UserDoc } from "@/lib/types";

export interface AuthContext {
  uid: string;
  email: string;
  role: Role;
  classId: string | null;
  rosterId: string | null;
}

/**
 * Authorization: Bearer <Firebase ID token> 을 검증한다.
 * 역할·소속 학급은 토큰의 custom claim이 아니라 users 문서를 신뢰원으로 삼는다.
 * (클레임은 토큰 갱신 전까지 낡을 수 있으므로 권한 판정은 항상 DB 기준)
 */
export async function getAuthContext(req: Request): Promise<AuthContext> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw unauthorized();

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email ?? "";
  } catch {
    throw unauthorized("로그인 정보가 만료되었습니다. 다시 로그인해주세요.");
  }

  const snap = await adminDb().collection(COL.users).doc(uid).get();
  if (!snap.exists) throw unauthorized("등록되지 않은 계정입니다.");
  const user = snap.data() as UserDoc;

  return {
    uid,
    email: user.email || email,
    role: user.role,
    classId: user.classId ?? null,
    rosterId: user.rosterId ?? null,
  };
}

export async function requireTeacher(req: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (ctx.role !== "teacher") throw forbidden("교사 계정만 사용할 수 있습니다.");
  return ctx;
}

/** 학급까지 등록을 마친 교사만 통과. 온보딩 이전에는 막힌다. */
export async function requireTeacherWithClass(
  req: Request,
): Promise<AuthContext & { classId: string }> {
  const ctx = await requireTeacher(req);
  if (!ctx.classId) throw forbidden("먼저 학급 정보를 등록해주세요.");
  return { ...ctx, classId: ctx.classId };
}

export async function requireStudent(
  req: Request,
): Promise<AuthContext & { classId: string; rosterId: string }> {
  const ctx = await getAuthContext(req);
  if (ctx.role !== "student") throw forbidden("학생 계정만 사용할 수 있습니다.");
  if (!ctx.classId || !ctx.rosterId) {
    throw forbidden("학급 명단과 연결되지 않은 계정입니다.");
  }
  return { ...ctx, classId: ctx.classId, rosterId: ctx.rosterId };
}

/** 교사가 자기 학급 자원에만 접근하는지 확인 */
export function assertOwnClass(ctx: AuthContext, classId: string) {
  if (ctx.classId !== classId) {
    throw forbidden("담당 학급의 자료만 볼 수 있습니다.");
  }
}
