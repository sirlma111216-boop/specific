import Link from "next/link";
import type { ReactNode } from "react";

/** 로그인·회원가입 공통 껍데기. design.md의 흰 캔버스 + 여백 중심 구성. */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 text-[13px] text-muted">
        ← 처음으로
      </Link>
      <p className="mb-3 text-[14px] font-medium tracking-[0.16px] text-muted">{eyebrow}</p>
      <h1 className="text-[32px] leading-[1.2] text-ink">{title}</h1>
      {description && <p className="prose-ko mt-3 text-[14px] text-muted">{description}</p>}
      <div className="mt-10">{children}</div>
      {footer && <div className="mt-8 text-[14px] text-muted">{footer}</div>}
    </main>
  );
}

/** Firebase Auth 오류 코드를 학생·교사가 읽을 수 있는 문장으로 바꾼다. */
export function translateFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/invalid-email":
      return "이메일 형식이 올바르지 않습니다.";
    case "auth/too-many-requests":
      return "로그인 시도가 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.";
    case "auth/network-request-failed":
      return "네트워크 연결을 확인해주세요.";
    case "auth/user-disabled":
      return "사용이 중지된 계정입니다. 담임 선생님께 문의해주세요.";
    default:
      return err instanceof Error ? err.message : "로그인에 실패했습니다.";
  }
}
