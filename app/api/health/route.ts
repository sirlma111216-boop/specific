/**
 * 배포 상태 점검용. 다른 모듈을 전혀 import하지 않는다.
 *
 * 이 라우트가 200이면 런타임 자체는 정상이고, 다른 API만 죽는 것이므로
 * firebase-admin 같은 특정 의존성 문제로 범위를 좁힐 수 있다.
 *
 * 비밀값은 절대 내보내지 않는다. 설정 여부와 길이만 알려준다.
 * (길이는 환경변수가 잘려 들어갔는지 확인하는 데 쓴다)
 */
export const dynamic = "force-dynamic";

function report(name: string, expectedLength?: number) {
  const value = process.env[name];
  if (!value) return { set: false as const };
  return {
    set: true as const,
    length: value.length,
    ...(expectedLength !== undefined ? { expected: expectedLength } : {}),
  };
}

export async function GET() {
  return Response.json({
    ok: true,
    node: process.version,
    region: process.env.VERCEL_REGION ?? null,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: report("NEXT_PUBLIC_FIREBASE_API_KEY"),
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: report("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
      FIREBASE_SERVICE_ACCOUNT_BASE64: report("FIREBASE_SERVICE_ACCOUNT_BASE64", 3176),
      GEMINI_API_KEY: report("GEMINI_API_KEY"),
      GEMINI_MODEL: report("GEMINI_MODEL"),
      TEACHER_SIGNUP_CODE: report("TEACHER_SIGNUP_CODE"),
      // 관리자 로그인이 안 될 때 원인을 가릴 수 있도록 설정 여부만 노출한다.
      ADMIN_EMAIL: report("ADMIN_EMAIL"),
      ADMIN_PASSWORD: report("ADMIN_PASSWORD"),
    },
  });
}
