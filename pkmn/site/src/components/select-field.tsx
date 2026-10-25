import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
