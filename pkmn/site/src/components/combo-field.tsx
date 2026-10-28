import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; count?: number };

export function ComboField({
  label,
  value,
  onChange,
  options,
  all,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly ComboOption[];
  all: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          "flex h-12 min-w-0 cursor-pointer items-center gap-2 rounded-[10px] border-3 border-border bg-ink px-3 text-[0.9375rem] font-bold text-foreground outline-none hover:border-cell-hi focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:border-primary",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{chosen?.label ?? (value || all)}</span>
        <ChevronDownIcon className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-72 max-w-[calc(100vw-2rem)] gap-1.5">
        <Command filter={(item, search) => (item.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search" aria-label={`Search ${label.toLowerCase()}`} />
          <CommandList className="mt-1.5">
            <CommandEmpty>Nothing matches</CommandEmpty>
            <CommandItem value={all} onSelect={() => pick("")} className={cn(value === "" && "text-primary")}>
              {all}
            </CommandItem>
            {options.map((option) => (
              <CommandItem key={option.value} value={`${option.label} ${option.value}`} onSelect={() => pick(option.value)} className={cn(option.value === value && "text-primary")}>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && <span className="flex-none font-heading text-lg font-normal text-muted-foreground tabular-nums">{option.count}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
