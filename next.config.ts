import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin(gRPC)과 exceljs는 번들링하지 않고 노드 모듈 그대로 쓴다.
  serverExternalPackages: ["firebase-admin", "exceljs"],
};

export default nextConfig;
