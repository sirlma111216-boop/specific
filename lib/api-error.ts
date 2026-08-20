/** API 라우트에서 던지는 사용자 표시용 오류. message는 그대로 한국어로 노출된다. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = "error") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code = "bad_request") {
  return new ApiError(400, message, code);
}
export function unauthorized(message = "로그인이 필요합니다.") {
  return new ApiError(401, message, "unauthorized");
}
export function forbidden(message = "접근 권한이 없습니다.") {
  return new ApiError(403, message, "forbidden");
}
export function notFound(message = "대상을 찾을 수 없습니다.") {
  return new ApiError(404, message, "not_found");
}
