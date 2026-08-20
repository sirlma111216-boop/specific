/**
 * firebase-admin 초기화만 따로 확인하는 진단 라우트.
 *
 * /api/health 는 되는데 여기서 실패하면 firebase-admin이 원인이고,
 * 이 라우트가 실패 이유를 문자열로 돌려주므로 로그 접근 없이도 원인을 알 수 있다.
 * 자격 증명이나 데이터는 내보내지 않는다.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const steps: Array<{ step: string; ok: boolean; detail?: string }> = [];

  const record = async (step: string, fn: () => Promise<unknown> | unknown) => {
    try {
      await fn();
      steps.push({ step, ok: true });
      return true;
    } catch (err) {
      steps.push({
        step,
        ok: false,
        detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      });
      return false;
    }
  };

  // 1) 모듈을 불러올 수 있는가 (여기서 죽으면 번들/의존성 문제)
  let admin: typeof import("@/lib/firebase/admin") | null = null;
  const loaded = await record("import firebase-admin 모듈", async () => {
    admin = await import("@/lib/firebase/admin");
  });

  // 2) 서비스 계정으로 초기화되는가 (여기서 죽으면 환경변수 문제)
  if (loaded && admin) {
    const mod = admin as typeof import("@/lib/firebase/admin");
    await record("서비스 계정 초기화", () => mod.adminAuth());

    // 3) Firestore에 실제로 닿는가 (여기서 죽으면 네트워크/권한 문제)
    await record("Firestore 연결", async () => {
      await mod.adminDb().collection(mod.COL.users).limit(1).get();
    });
  }

  const ok = steps.every((s) => s.ok);
  return Response.json({ ok, steps }, { status: ok ? 200 : 500 });
}
