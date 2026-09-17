import "server-only";

import { adminAuth, adminDb, COL } from "@/lib/firebase/admin";
import { forbidden, unauthorized } from "@/lib/api-error";
import { cached, invalidate } from "@/lib/server-cache";

/** 계정 문서 캐시 수명. 역할·소속은 거의 바뀌지 않는다. 바뀌는 곳에서는 forgetUser 를 부른다. */
const USER_TTL_MS = 60 * 1000;

/** 계정 문서를 바꾼 뒤 부른다 (역할·학급·명단·비밀번호 초기화 표시). */
export function forgetUser(uid: string): void {
  invalidate(`user:${uid}`);
}
import { isStaff, type Role, type UserDoc } from "@/lib/types";

export interface AuthContext {
  uid: string;
  email: string;
  role: Role;
  classId: string | null;
  rosterId: string | null;
  /** 연수용 테스트 계정인가. 활동 노출 범위를 가르는 기준이다. */
  isTest: boolean;
  /** 담임이 비밀번호를 초기화한 학생. 새 비밀번호를 정하기 전까지 다른 API를 막는다. */
  mustChangePassword: boolean;
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

  // 호출마다 1건씩 읽던 것을 잠깐 캐시한다. 비밀번호 초기화 표시가 켜진 계정은 캐시하지 않아
  // 새 비밀번호를 정하는 즉시 풀린다.
  const user = await cached<UserDoc | null>(`user:${uid}`, USER_TTL_MS, async () => {
    const snap = await adminDb().collection(COL.users).doc(uid).get();
    return snap.exists ? (snap.data() as UserDoc) : null;
  });
  if (!user) {
    invalidate(`user:${uid}`);
    throw unauthorized("등록되지 않은 계정입니다.");
  }
  if (user.mustChangePassword) invalidate(`user:${uid}`);

  return {
    uid,
    email: user.email || email,
    role: user.role,
    classId: user.classId ?? null,
    rosterId: user.rosterId ?? null,
    isTest: Boolean(user.isTest),
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export async function requireTeacher(req: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (ctx.role !== "teacher") throw forbidden("교사 계정만 사용할 수 있습니다.");
  return ctx;
}

/**
 * 슈퍼관리자 전용.
 * 역할은 users 문서를 신뢰원으로 삼는다. 이 문서는 서버(Admin SDK)만 쓸 수 있고
 * 브라우저 쓰기는 보안 규칙에서 전부 막혀 있으므로, 역할이 admin 이면 그 자체로 충분하다.
 * (예전에는 ADMIN_EMAIL 과도 대조했다. 슈퍼관리자 계정을 화면에서 바꿀 수 있게 하면서 뺐다)
 */
export async function requireAdmin(req: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (ctx.role !== "admin") throw forbidden("슈퍼관리자만 사용할 수 있습니다.");
  return ctx;
}

/** 활동(일정·양식) 관리: 슈퍼관리자와 일정 관리자. */
export async function requireStaff(req: Request): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (!isStaff(ctx.role)) throw forbidden("관리자만 사용할 수 있습니다.");
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
  options: { allowPendingPassword?: boolean } = {},
): Promise<AuthContext & { classId: string; rosterId: string }> {
  const ctx = await getAuthContext(req);
  if (ctx.role !== "student") throw forbidden("학생 계정만 사용할 수 있습니다.");
  if (!ctx.classId || !ctx.rosterId) {
    throw forbidden("학급 명단과 연결되지 않은 계정입니다.");
  }
  // 초기화된 비밀번호로 들어온 학생은 새 비밀번호를 정하기 전까지 다른 일을 하지 못한다.
  if (ctx.mustChangePassword && !options.allowPendingPassword) {
    throw forbidden("먼저 새 비밀번호를 정해주세요.", "password_change_required");
  }
  return { ...ctx, classId: ctx.classId, rosterId: ctx.rosterId };
}

/** 교사가 자기 학급 자원에만 접근하는지 확인 */
export function assertOwnClass(ctx: AuthContext, classId: string) {
  if (ctx.classId !== classId) {
    throw forbidden("담당 학급의 자료만 볼 수 있습니다.");
  }
}
