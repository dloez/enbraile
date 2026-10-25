import { useState } from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MonSprite } from "@/components/pc/summary";
import { PcBox, SummaryAside, SummarySheet } from "@/components/pc/pc-box";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { displayName, type Mon } from "@/teams/dex";
import type { Sheet } from "@/teams/schema";
import { memberMon, type Slots } from "@/teams/team";
import type { ExportGap } from "../../../shared/snapshot";

export function AddDialog({ slot, slots, mons, sheet, gaps, source, onClose, onPut }: {
  slot: number | null;
  slots: Slots;
  mons: readonly Mon[];
  sheet: Sheet;
  gaps: readonly ExportGap[];
  source: string;
  onClose: () => void;
  onPut: (slot: number, mon: Mon) => void;
}) {
  const wide = useMediaQuery("(min-width: 64rem)");
  const [picked, setPicked] = useState<number | null>(null);
  const taken = new Set(slots.flatMap((m) => (m ? [m.index] : [])));
  const selected = picked ?? (wide ? 0 : null);
  const mon = selected === null ? undefined : mons[selected];
  const open = slot !== null;

  function close() {
    setPicked(null);
    onClose();
  }

  const put = (target: Mon) => {
    const blocked = taken.has(target.index);
    return (
      <div className="flex-none border-t-3 px-4.5 py-3.5">
        <button
          type="button"
          disabled={blocked || slot === null}
          onClick={() => {
            if (slot === null) return;
            setPicked(null);
            onPut(slot, target);
          }}
          className={buttonVariants({ variant: "go", className: "min-h-13 w-full rounded-[10px] text-[1.625rem]" })}
        >
          {blocked ? "In the team" : `Put in slot ${(slot ?? 0) + 1}`}
        </button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="inset-0 top-0 left-0 flex h-svh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none"
      >
        <div className="flex min-h-19 flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b-4 border-red bg-ink py-3 pr-4 pl-4 sm:pr-8 sm:pl-10">
          <DialogTitle className="m-0 font-heading text-[2.5rem] leading-none font-normal">Add to slot {(slot ?? 0) + 1}</DialogTitle>
          <span className="rounded-[10px] border-3 bg-background px-3.5 py-1 font-heading text-[1.375rem] text-white">{source}</span>
          <div className="flex-1" />
          <span className="font-heading text-xl text-muted-foreground max-sm:hidden">Team</span>
          <div className="flex gap-1 max-sm:hidden">
            {slots.map((m, at) => {
              const held = memberMon(m, mons);
              const target = at === slot;
              return (
                <span
                  key={at}
                  title={held ? displayName(held) : "Empty"}
                  className={cn(
                    "flex h-11 w-12 items-center justify-center overflow-hidden rounded-lg border-2 font-heading text-xl text-yellow",
                    target ? "border-yellow bg-yellow/14" : m ? "border-solid bg-card" : "border-dashed",
                  )}
                >
                  {held ? <MonSprite mon={held} className="-mx-1 -mt-1.5 -mb-0.5 size-13 flex-none" /> : target && at + 1}
                </span>
              );
            })}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="ml-2 grid size-12 flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex min-h-0 flex-1 gap-6 px-4 pt-5 pb-4 sm:px-10 sm:pb-8">
          <PcBox mons={mons} selected={selected} onPick={setPicked} taken={taken} />
          {wide && mon && <SummaryAside mon={mon} sheet={sheet} gaps={gaps} footer={put(mon)} />}
        </div>
        {!wide && <SummarySheet mon={mon} sheet={sheet} gaps={gaps} open={open && mon !== undefined} onClose={() => setPicked(null)} footer={mon && put(mon)} />}
      </DialogContent>
    </Dialog>
  );
}
