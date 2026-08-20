import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** design.md의 content card. 10px radius + hairline, 그림자 없음(색 대비로 층을 만든다). */
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-hairline bg-canvas",
        padded && "p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** design.md의 cream-callout-card */
export function CalloutCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md bg-cream p-6 text-ink", className)}>{children}</div>
  );
}

/** design.md의 hero-card-dark */
export function DarkCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg bg-surface-dark p-8 text-white", className)}>{children}</div>
  );
}

type Tone = "neutral" | "success" | "muted" | "coral" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-strong text-ink",
  success: "bg-mint text-forest",
  muted: "bg-surface-soft text-muted border border-hairline",
  coral: "bg-coral text-white",
  info: "bg-cream text-ink",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[12px] font-medium leading-[1.6] whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info" | "success";
}) {
  const styles = {
    error: "border-coral/30 bg-[#fdf2ee] text-coral",
    info: "border-hairline bg-surface-soft text-body",
    success: "border-success-border/40 bg-[#f1faf2] text-success",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("prose-ko mb-4 rounded-md border px-4 py-3 text-[14px] whitespace-pre-line", styles)}
    >
      {children}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-[32px] leading-[1.2] text-ink">{children}</h1>
      {sub && <p className="mt-2 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}

export function Spinner({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[14px] text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      {label}
    </div>
  );
}
