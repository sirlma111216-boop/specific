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
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `서버 오류가 발생했습니다. (${detail})`, code: "internal" },
        { status: 500 },
      );
    },
  );
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "요청 본문을 읽을 수 없습니다.", "bad_json");
  }
}
