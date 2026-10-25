import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export const buttonClass = buttonVariants();

export const iconButtonClass = buttonVariants({ size: "icon" });

export const quietIconClass = buttonVariants({ variant: "ghost", size: "icon-sm" });

export const liftCardClass =
  "rounded-2xl border-4 border-cell bg-card text-foreground outline-none transition-[translate,box-shadow,border-color] duration-120 ease-[steps(2)] hover:-translate-y-1 hover:border-primary hover:shadow-[0_8px_0_0_var(--drop)] focus-visible:-translate-y-1 focus-visible:border-primary focus-visible:shadow-[0_8px_0_0_var(--drop)] motion-reduce:transition-none";

const ALL = "__all";

export function SelectField({
  label,
  value,
  onChange,
  options,
  all,
  size = "md",
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: ReactNode; disabled?: boolean }[];
  all?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select disabled={disabled} value={value === "" && all ? ALL : value} onValueChange={(next) => onChange(next === ALL ? "" : next)}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "w-auto min-w-0 cursor-pointer gap-2 rounded-[10px] border-3 border-border bg-ink font-sans font-bold text-foreground shadow-none outline-none hover:border-cell-hi focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60 data-[state=open]:border-primary [&_svg]:text-muted-foreground",
          size === "sm" ? "h-10! px-2.5 text-sm" : "h-12! px-3 text-[0.9375rem]",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={6}
        className="max-h-80 rounded-xl border-3 border-cell-hi bg-ink p-1 text-foreground shadow-[0_8px_0_0_var(--edge)] ring-0"
      >
        {all && (
          <SelectItem value={ALL} className="cursor-pointer rounded-lg py-2 pr-8 pl-2.5 text-sm font-bold focus:bg-cell focus:text-white">
            {all}
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="cursor-pointer rounded-lg py-2 pr-8 pl-2.5 text-sm font-bold focus:bg-cell focus:text-white"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
