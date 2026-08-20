import "server-only";

import { NextResponse } from "next/server";
import { ApiError } from "./api-error";

/**
 * 모든 API 라우트의 공통 래퍼.
 * - ApiError는 상태코드와 한국어 메시지를 그대로 내려준다.
 * - 그 외 예외는 500으로 감싸되, 서버 로그에는 원문을 남겨 진단이 가능하게 한다.
 */
export function route<T>(handler: () => Promise<T>) {
  return handler().then(
    (data) => NextResponse.json(data ?? { ok: true }),
    (err: unknown) => {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status },
        );
      }
      console.error("[api] unhandled error:", err);

      // Firestore 무료 등급의 하루 할당량(읽기 5만/쓰기 2만)을 넘기면 여기로 온다.
      // "서버 오류"로만 보이면 원인을 알 수 없으므로 무슨 일인지 그대로 알려준다.
      if (isQuotaExceeded(err)) {
        return NextResponse.json(
          {
            error:
              "오늘 사용할 수 있는 데이터 조회량을 모두 썼습니다. 내일 다시 이용하거나, 담당 선생님께 문의해주세요.",
            code: "quota_exceeded",
          },
          { status: 503 },
        );
      }

      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `서버 오류가 발생했습니다. (${detail})`, code: "internal" },
        { status: 500 },
      );
    },
  );
}

/** Firestore 할당량 초과(gRPC code 8 = RESOURCE_EXHAUSTED) 판별 */
function isQuotaExceeded(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number | string; message?: string };
  if (e.code === 8 || e.code === "resource-exhausted") return true;
  return /RESOURCE_EXHAUSTED|Quota exceeded/i.test(e.message ?? "");
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "요청 본문을 읽을 수 없습니다.", "bad_json");
  }
}
