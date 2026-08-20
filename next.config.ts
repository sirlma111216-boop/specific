import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // serverExternalPackages 로 firebase-admin 을 번들에서 빼두었더니 Vercel에서
  // 모든 API가 본문 없는 500을 냈다. 원인:
  //   firebase-admin → jwks-rsa(CJS) → jose@6(ESM 전용)
  //   외부 모듈 로더가 require()로 불러오면서 ERR_REQUIRE_ESM.
  // 번들러가 직접 처리하면 ESM/CJS 상호운용이 빌드 시점에 해결되므로 기본값을 쓴다.
};

export default nextConfig;
