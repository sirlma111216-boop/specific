import Link from "next/link";

/**
 * 모든 화면 맨 아래에 붙는 푸터. labbitory.com 공통 푸터와 같은 구성이다.
 *
 * 개인정보 보호책임자의 이름·소속·연락처는 개인정보 보호법 제30조에 따라
 * 처리방침에 공개해야 하는 정보라 그대로 적는다.
 * 저작권 연도는 최초 게시 연도를 뜻하므로 해가 바뀌어도 갱신하지 않는다.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-gradient-to-r from-cream/45 via-canvas to-mint/35">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-4 text-[12px] leading-[1.6] text-muted">
        <p>© 2026 labbitory.com. All rights reserved.</p>
        <p>
          개인정보책임자: 김도윤 교사 (경희여자중학교){" "}
          <span aria-hidden className="mx-1 text-hairline">
            |
          </span>{" "}
          문의: 02-6072-1885
        </p>
        <nav aria-label="약관" className="flex items-center gap-3">
          <Link href="/terms" className="font-medium text-body">
            이용약관
          </Link>
          <span aria-hidden className="text-hairline">
            |
          </span>
          <Link href="/privacy" className="font-medium text-body">
            개인정보처리방침
          </Link>
        </nav>
      </div>
    </footer>
  );
}
