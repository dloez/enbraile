import { useState } from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MonSprite } from "@/components/pc/mon-sprite";
import { PcBox, SummaryAside, SummarySheet } from "@/components/pc/pc-box";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { segButton, segTrack } from "@/teams/components/editors";
import type { PoolFilters } from "@/analysis/pool";
import { FreePicker } from "@/teams/components/free-member";
import { allowedMoves, displayName, type BagTm, type Mon } from "../../../shared/mon";
import { memberMon } from "@/teams/dex";
import { ownOf, type FreeMember, type Slots, type Stocks } from "@/teams/team";
import type { Sheet } from "@/teams/schema";
import type { ExportGap } from "../../../shared/snapshot";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    any: "Any Pokémon",
    inTeam: "In the team",
    putIn: (slot: number) => `Put in slot ${slot}`,
    title: (slot: number) => `Add to slot ${slot}`,
    from: "From",
    team: "Team",
    empty: "Empty",
    close: "Close",
  },
  es: {
    any: "Cualquier Pokémon",
    inTeam: "En el equipo",
    putIn: (slot: number) => `Poner en el hueco ${slot}`,
    title: (slot: number) => `Añadir al hueco ${slot}`,
    from: "De",
    team: "Equipo",
    empty: "Vacío",
    close: "Cerrar",
  },
});

export interface AddSource {
  id: string;
  label: string;
  series: number;
  sheet: Sheet;
  mons: readonly Mon[];
  tms: readonly BagTm[];
  gaps: readonly ExportGap[];
}

export const ANY = "any";

export function AddDialog({ slot, slots, stocks, sources, anyPokemon, pool, onClose, onPut, onPutFree }: {
  slot: number | null;
  slots: Slots;
  stocks: Stocks;
  sources: readonly AddSource[];
  anyPokemon: boolean;
  pool: PoolFilters;
  onClose: () => void;
  onPut: (slot: number, mon: Mon, source: string) => void;
  onPutFree: (slot: number, member: FreeMember) => void;
}) {
  const wide = useMediaQuery("(min-width: 64rem)");
  const [picked, setPicked] = useState<number | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const tabs = [...sources.map((s) => ({ id: s.id, label: s.label })), ...(anyPokemon ? [{ id: ANY, label: t.any }] : [])];
  const tab = tabs.find((option) => option.id === from) ?? tabs[0];
  const free = tab?.id === ANY;
  const source = free ? undefined : sources.find((s) => s.id === tab?.id);
  const mons = source?.mons ?? [];
  const sheet = source?.sheet;
  const gaps = source?.gaps ?? [];
  const taken = new Set(
    slots.flatMap((m) => {
      const own = ownOf(m);
      return own && own.source === source?.id ? [own.index] : [];
    }),
  );
  const selected = picked ?? (wide && mons.length > 0 ? 0 : null);
  const mon = selected === null ? undefined : mons[selected];
  const shown = mon && { ...mon, learnable: allowedMoves(mon, pool.moves) };
  const open = slot !== null && tab !== undefined;

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
            if (slot === null || !source) return;
            setPicked(null);
            onPut(slot, target, source.id);
          }}
          className={buttonVariants({ variant: "go", className: "min-h-13 w-full rounded-[10px] text-[1.625rem]" })}
        >
          {blocked ? t.inTeam : t.putIn((slot ?? 0) + 1)}
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
          <DialogTitle className="m-0 font-heading text-[2.5rem] leading-none font-normal">{t.title((slot ?? 0) + 1)}</DialogTitle>
          <div role="tablist" aria-label={t.from} className={cn(segTrack, "max-w-full overflow-x-auto bg-background")}>
            {tabs.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={option.id === tab?.id}
                onClick={() => {
                  setFrom(option.id);
                  setPicked(null);
                }}
                className={cn(segButton(option.id === tab?.id), "min-h-9.5 px-3.5 text-[1.375rem] whitespace-nowrap")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <span className="font-heading text-xl text-muted-foreground max-sm:hidden">{t.team}</span>
          <div className="flex gap-1 max-sm:hidden">
            {slots.map((m, at) => {
              const held = memberMon(m, stocks);
              const target = at === slot;
              return (
                <span
                  key={at}
                  title={held ? displayName(held) : t.empty}
                  className={cn(
                    "flex h-11 w-12 items-center justify-center overflow-hidden rounded-lg border-2 font-heading text-xl text-yellow",
                    target ? "border-yellow bg-yellow/14" : m ? "border-solid bg-card" : "border-dashed",
                  )}
                >
                  {held ? <MonSprite mon={held} className="size-full object-contain" /> : target && at + 1}
                </span>
              );
            })}
          </div>
          <DialogPrimitive.Close
            aria-label={t.close}
            className="ml-2 grid size-12 flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex min-h-0 flex-1 gap-6 px-4 pt-5 pb-4 sm:px-10 sm:pb-8">
          {free && slot !== null ? (
            <FreePicker slot={slot} wide={wide} pool={pool} onPut={(member) => onPutFree(slot, member)} />
          ) : (
            <>
              <PcBox key={source?.id} mons={mons} selected={selected} onPick={setPicked} taken={taken} />
              {wide && mon && shown && sheet && <SummaryAside mon={shown} tms={source.tms} gaps={gaps} series={source.series} footer={put(mon)} />}
            </>
          )}
        </div>
        {!wide && !free && sheet && <SummarySheet mon={shown} tms={source.tms} gaps={gaps} series={source.series} open={open && mon !== undefined} onClose={() => setPicked(null)} footer={mon && put(mon)} />}
      </DialogContent>
    </Dialog>
  );
}
