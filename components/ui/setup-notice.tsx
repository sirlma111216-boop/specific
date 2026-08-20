import { Card } from "./surface";

/** Firebase 환경변수가 없을 때 흰 화면 대신 무엇을 해야 하는지 알려준다. */
export function SetupNotice() {
  return (
    <main className="mx-auto max-w-[720px] px-6 py-20">
      <h1 className="mb-4 text-[32px] leading-[1.2] text-ink">설정이 필요합니다</h1>
      <p className="prose-ko mb-8 text-muted">
        Firebase 연결 정보가 없어 앱을 시작할 수 없습니다. 프로젝트 루트의{" "}
        <code className="rounded-xs bg-surface-soft px-1.5 py-0.5 text-ink">.env.local</code> 파일에
        아래 값을 채운 뒤 개발 서버를 다시 시작해주세요.
      </p>
      <Card>
        <pre className="overflow-x-auto text-[13px] leading-[1.8] text-body">
{`NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_SERVICE_ACCOUNT_BASE64=
GEMINI_API_KEY=
TEACHER_SIGNUP_CODE=`}
        </pre>
      </Card>
      <p className="mt-6 text-[14px] text-muted">
        자세한 절차는 프로젝트의 <strong className="text-ink">SETUP.md</strong> 파일에 정리되어
        있습니다.
      </p>
    </main>
  );
}
