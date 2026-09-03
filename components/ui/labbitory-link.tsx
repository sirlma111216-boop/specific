import Image from "next/image";
import { cn } from "@/lib/utils";

const HREF = "https://labbitory.com/useful";
const LABEL = "labbitory.com의 교실 앱 모음 열기";

/**
 * 좌상단 labbitory.com 바로가기.
 *
 * 앱 밖으로 나가는 링크라 새 탭으로 연다. 같은 탭에서 열면 소감이나 특기사항을
 * 쓰던 중에 눌렀을 때 작성 중인 내용을 잃는다.
 *
 * 아이콘만 있는 링크여서 화면 낭독기가 읽을 이름을 aria-label로 따로 준다.
 */
export function LabbitoryLink({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <a
      href={HREF}
      target="_blank"
      rel="noopener noreferrer"
      title={LABEL}
      aria-label={`${LABEL} (새 탭)`}
      className={cn(
        "inline-flex shrink-0 rounded-full transition-opacity hover:opacity-75 active:opacity-60",
        className,
      )}
    >
      <Image
        src="/labbitory-logo.png"
        alt=""
        width={size}
        height={size}
        // Next 16에서 priority는 폐기됐다. 헤더 로고는 LCP가 아니므로 preload가 아니라
        // eager 로딩만 준다. lazy로 두면 첫 화면에서 아이콘이 늦게 떠 깜빡인다.
        loading="eager"
        className="block rounded-full"
      />
    </a>
  );
}
