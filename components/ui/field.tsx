import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** design.md text-input: 6px radius, 44px height, 1px hairline */
const INPUT_BASE =
  "w-full rounded-sm border border-hairline bg-canvas px-4 text-[14px] text-ink placeholder:text-[#9297a0] disabled:bg-surface-soft disabled:text-muted";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[14px] font-medium text-ink">
      {children}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-[13px] text-coral">{error}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(INPUT_BASE, "h-11", className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(INPUT_BASE, "prose-ko resize-y py-3", className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(INPUT_BASE, "h-11 appearance-none pr-9", className)}>
      {children}
    </select>
  );
}
