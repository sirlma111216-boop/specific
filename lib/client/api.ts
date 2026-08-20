"use client";

import { clientAuth } from "@/lib/firebase/client";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code = "error") {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

/** 모든 API 호출에 Firebase ID 토큰을 붙인다. 서버는 이 토큰으로 역할과 소속을 판정한다. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  const user = clientAuth().currentUser;
  if (user) headers.set("authorization", `Bearer ${await user.getIdToken()}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new ApiClientError(
      typeof data.error === "string" ? data.error : "요청에 실패했습니다.",
      res.status,
      typeof data.code === "string" ? data.code : "error",
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "알 수 없는 오류가 발생했습니다.";
}
