import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-3.5", className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="m-0 font-heading text-base font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-0.5 rounded-[10px] border bg-muted p-0.75", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 flex-1 cursor-pointer rounded-[7px] px-3.5 text-[13px] font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            o.value === value ? "bg-secondary text-foreground" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  pressed,
  onChange,
  children,
  disabled,
  title,
}: {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!pressed)}
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50",
        pressed ? "border-primary bg-accent text-primary" : "bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export const fieldClass =
  "flex min-h-10 min-w-0 items-center gap-2 rounded-lg border bg-muted px-2.5 text-[13px] text-foreground";

export const buttonClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-card px-3 text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50";

export const primaryClass =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50";

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
