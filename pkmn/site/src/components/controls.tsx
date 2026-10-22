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
    <section aria-label={title} className={cn("flex min-w-0 flex-col gap-3 rounded-2xl border-3 bg-card p-4", className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="m-0 font-heading text-2xl">{title}</h3>
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
            "min-h-9 flex-1 cursor-pointer rounded-md px-3.5 font-heading text-xl whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            o.value === value ? "bg-red text-white" : "text-subtle hover:bg-face hover:text-white",
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
      className={cn(buttonVariants(), pressed && "bg-primary text-primary-foreground hover:bg-primary")}
    >
      {children}
    </button>
  );
}

export const fieldClass =
  "flex min-h-10 min-w-0 items-center gap-2 rounded-lg border bg-muted px-2.5 text-sm text-foreground";

export const buttonClass = buttonVariants();

export const iconButtonClass = buttonVariants({ size: "icon" });

export const quietIconClass = buttonVariants({ variant: "ghost", size: "icon-sm" });

export const liftCardClass =
  "rounded-2xl border-4 border-cell bg-card text-foreground outline-none transition-[translate,box-shadow,border-color] duration-120 ease-[steps(2)] hover:-translate-y-1 hover:border-primary hover:shadow-[0_8px_0_0_var(--drop)] focus-visible:-translate-y-1 focus-visible:border-primary focus-visible:shadow-[0_8px_0_0_var(--drop)] motion-reduce:transition-none";
