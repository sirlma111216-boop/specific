import Link from "next/link";
import type { ReactNode } from "react";

/** 이용약관·개인정보처리방침 공통 껍데기. 읽기 전용 문서라 가장 단순한 구성으로 둔다. */
export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-6 py-14">
      <Link href="/" className="mb-10 inline-block text-[13px] text-muted">
        ← 처음으로
      </Link>
      <h1 className="text-[32px] leading-[1.2] text-ink">{title}</h1>
      <p className="mt-2 text-[14px] text-muted">시행일: {effectiveDate}</p>
      <div className="prose-ko mt-10 text-[14px] text-body">{children}</div>
    </main>
  );
}

/** 제n조 한 묶음. */
export function Article({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-[16px] font-medium text-ink">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

/** 조문 안의 항목 나열. */
export function Items({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}
