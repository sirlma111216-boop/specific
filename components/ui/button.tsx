import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

/**
 * design.md의 button-primary / button-secondary.
 * primary는 near-black(#181d26) + 12px radius. 화면당 하나만 쓰는 것이 원칙이다.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-white border border-primary active:bg-primary-active disabled:bg-[#9297a0] disabled:border-[#9297a0]",
  secondary:
    "bg-canvas text-ink border border-hairline active:bg-surface-soft disabled:text-[#9297a0] disabled:border-[#9297a0]",
  ghost: "bg-transparent text-body border border-transparent active:bg-surface-soft",
  danger: "bg-canvas text-coral border border-hairline active:bg-surface-soft",
};

const SIZES: Record<Size, string> = {
  md: "px-6 py-4 text-[16px]",
  sm: "px-4 py-2.5 text-[14px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium leading-[1.4] transition-colors",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      )}
      {children}
    </button>
  );
}
