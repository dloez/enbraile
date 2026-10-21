import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
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
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-0.5 rounded-lg border bg-muted p-0.75", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 flex-1 cursor-pointer rounded-md px-3.5 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
      className={cn(buttonVariants({ variant: "outline" }), pressed && "border-primary bg-accent text-primary")}
    >
      {children}
    </button>
  );
}

export const fieldClass =
  "flex min-h-10 min-w-0 items-center gap-2 rounded-lg border bg-muted px-2.5 text-sm text-foreground";

export const buttonClass = buttonVariants({ variant: "outline" });

export const primaryClass = buttonVariants();

export const iconButtonClass = buttonVariants({ variant: "outline", size: "icon" });

export const quietIconClass = buttonVariants({ variant: "ghost", size: "icon-sm" });
