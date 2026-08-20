import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/client/auth-context";

export const metadata: Metadata = {
  title: "생기부 자율·진로 기록 도우미",
  description:
    "학생이 활동 소감을 기록하고, 교사가 이를 바탕으로 창의적 체험활동 특기사항 초안을 만드는 도구",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 학생 대부분이 스마트폰으로 쓰는 화면이라 확대는 막지 않는다.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
