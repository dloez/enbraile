import { cn } from "@/lib/utils";
import { describeItem, displayName, type Mon } from "@/open-sheet/dex";
import { memberMon, type Slots } from "@/open-sheet/team";
import { ItemIcon } from "@/open-sheet/components/bag";
import { MonSprite } from "@/open-sheet/components/summary";

interface TeamStripProps {
  slots: Slots;
  mons: readonly Mon[];
  selected: number | null;
  onPick: (index: number) => void;
}

export function TeamStrip({ slots, mons, selected, onPick }: TeamStripProps) {
  return (
    <section
      aria-label="Team"
      className="mx-3 grid flex-none grid-cols-[repeat(6,minmax(48px,1fr))] gap-1.5 overflow-x-auto rounded-[14px] bg-box p-2 sm:mx-6 sm:grid-cols-[repeat(6,minmax(120px,1fr))] sm:gap-2 sm:p-2.5"
    >
      {slots.map((member, slot) => {
        const mon = memberMon(member, mons);
        if (!member || !mon) {
          return (
            <span
              key={slot}
              role="img"
              aria-label="Empty slot"
              className="h-14 rounded-[10px] border-2 border-dashed border-cell-hi sm:h-18"
            />
          );
        }
        const item = member.item ? describeItem({ item: member.item, quantity: 1 }) : null;
        const active = mon.index === selected;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onPick(mon.index)}
            aria-label={displayName(mon)}
            aria-pressed={active}
            className={cn(
              "relative flex h-14 min-w-0 cursor-pointer items-center gap-2 rounded-[10px] border-2 px-0 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-18 sm:px-2",
              active ? "border-primary bg-cell-hi" : "border-transparent bg-cell",
            )}
          >
            <MonSprite mon={mon} className="size-12 flex-none sm:size-16" />
            <span className="hidden min-w-0 flex-col gap-0.5 lg:flex">
              <span className="truncate font-semibold">{displayName(mon)}</span>
              <span className="truncate text-xs text-muted-foreground">{mon.species.name}</span>
            </span>
            {item && (
              <span title={item.name} className="absolute right-1 bottom-1 rounded-md bg-card">
                <ItemIcon item={item} />
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
