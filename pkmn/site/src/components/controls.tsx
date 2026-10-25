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
  labelledBy,
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  label?: string;
  labelledBy?: string;
  options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn(
        "inline-flex bg-muted",
        size === "lg" ? "gap-1 rounded-xl border-3 p-1" : "gap-0.5 rounded-lg border p-0.75",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 cursor-pointer px-3.5 font-heading whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
            size === "lg" ? "min-h-11 rounded-lg text-[1.4375rem]" : "min-h-9 rounded-md text-xl",
            o.value === value
              ? "bg-red text-white"
              : o.disabled
                ? "text-faint"
                : size === "lg"
                  ? "text-foreground hover:bg-cell hover:text-white"
                  : "text-subtle hover:bg-face hover:text-white",
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

export const formFieldClass =
  "h-11.5 min-w-0 rounded-[10px] border-3 bg-ink px-3 font-sans text-[1.0625rem] font-bold text-foreground outline-none placeholder:font-semibold placeholder:text-faint focus:border-primary focus:ring-3 focus:ring-ring/30 disabled:opacity-55 aria-invalid:border-destructive";

export const formLabelClass = "flex min-w-0 flex-col gap-1 font-heading text-xl text-muted-foreground";

export const buttonClass = buttonVariants();

export const iconButtonClass = buttonVariants({ size: "icon" });

export const quietIconClass = buttonVariants({ variant: "ghost", size: "icon-sm" });

export const liftCardClass =
  "rounded-2xl border-4 border-cell bg-card text-foreground outline-none transition-[translate,box-shadow,border-color] duration-120 ease-[steps(2)] hover:-translate-y-1 hover:border-primary hover:shadow-[0_8px_0_0_var(--drop)] focus-visible:-translate-y-1 focus-visible:border-primary focus-visible:shadow-[0_8px_0_0_var(--drop)] motion-reduce:transition-none";
