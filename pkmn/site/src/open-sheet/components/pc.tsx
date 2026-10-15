import { useMemo, useState } from "react";
import { Search, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { describePokemon, displayName, TYPES, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { Bag } from "@/open-sheet/components/bag";
import { MonSprite, SummaryBody, SummaryHead } from "@/open-sheet/components/summary";
import { Sheet as BottomSheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

function matches(mon: Mon, query: string, type: string): boolean {
  const q = query.trim().toLowerCase();
  const named = !q || mon.species.name.toLowerCase().includes(q) || (mon.nickname ?? "").toLowerCase().includes(q);
  return named && (!type || mon.filterTypes.includes(type));
}

function Cell({ mon, selected, onPick }: { mon: Mon; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`${displayName(mon)}, ${mon.species.name}, level ${mon.level ?? "unknown"}`}
      aria-pressed={selected}
      className={cn(
        "relative grid aspect-square cursor-pointer place-items-center rounded-[10px] border-2 p-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-primary bg-cell-hi" : "border-transparent bg-cell",
      )}
    >
      <MonSprite mon={mon} className="pointer-events-none w-[92%]" />
      <span className="absolute top-1 left-1.25 font-mono text-[11px] text-muted-foreground">{mon.level ?? "?"}</span>
      {mon.species.marked && <span className="absolute top-0.5 right-1.5 text-[11px] font-bold text-destructive">?</span>}
      <span className="absolute inset-x-1 bottom-0.75 hidden truncate text-center text-[11px] sm:block">{displayName(mon)}</span>
    </button>
  );
}

export function Pc({ sheet }: { sheet: Sheet }) {
  const wide = useMediaQuery("(min-width: 64rem)");
  const mons = useMemo(() => sheet.pokemon.map(describePokemon), [sheet]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [bagOpen, setBagOpen] = useState(false);

  const shown = mons.filter((mon) => matches(mon, query, type));
  const selected = picked ?? (wide ? 0 : null);
  const selectedMon = selected === null ? undefined : mons[selected];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-6">
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setBagOpen(true)}
          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 py-2 font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ShoppingBag className="size-4.5" aria-hidden="true" />
          Bag
        </button>
      </div>
      <div className="flex flex-1 gap-4 px-3 pt-1 pb-3 sm:px-6 sm:pb-6">
        <section aria-label="PC" className="flex min-w-0 flex-1 flex-col self-start rounded-2xl bg-box text-foreground">
          <div className="flex flex-none flex-wrap items-center gap-2.5 px-3.5 py-3">
            <span className="font-heading text-[17px] font-semibold tracking-[0.04em]">
              PC <span className="font-medium text-muted-foreground">{mons.length}</span>
            </span>
            <div className="flex-1" />
            <label className="flex min-h-10 max-w-60 flex-[1_1_140px] items-center gap-2 rounded-lg bg-cell px-2.5">
              <Search className="size-4 flex-none" aria-hidden="true" />
              <span className="sr-only">Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            <label className="flex items-center">
              <span className="sr-only">Type</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="min-h-10 rounded-lg bg-cell px-2.5 text-foreground"
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2 px-3.5 pb-3.5 sm:grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
            {shown.map((mon) => (
              <Cell key={mon.index} mon={mon} selected={mon.index === selected} onPick={() => setPicked(mon.index)} />
            ))}
          </div>
        </section>
        {wide && selectedMon && (
          <aside
            aria-label="Summary"
            className="sticky top-4 flex max-h-[calc(100svh-2rem)] w-100 flex-none flex-col self-start overflow-hidden rounded-2xl border bg-card"
          >
            <div className="flex flex-none items-center px-4.5 pt-4">
              <SummaryHead
                mon={selectedMon}
                title={(text) => <h2 className="m-0 font-heading text-[22px] leading-[1.1] font-bold">{text}</h2>}
              />
            </div>
            <SummaryBody key={selectedMon.index} mon={selectedMon} />
          </aside>
        )}
      </div>
      {!wide && (
        <BottomSheet open={selectedMon !== undefined} onOpenChange={(open) => !open && setPicked(null)}>
          <SheetContent
            side="bottom"
            aria-describedby={undefined}
            className="max-h-[90svh] gap-0 overflow-hidden rounded-t-[20px] bg-card"
          >
            {selectedMon && (
              <>
                <div className="flex flex-none items-center pt-4 pr-12 pl-4">
                  <SummaryHead
                    mon={selectedMon}
                    title={(text) => (
                      <SheetTitle className="font-heading text-xl leading-[1.1] font-bold">{text}</SheetTitle>
                    )}
                  />
                </div>
                <SummaryBody key={selectedMon.index} mon={selectedMon} />
              </>
            )}
          </SheetContent>
        </BottomSheet>
      )}
      <Bag sheet={sheet} open={bagOpen} onOpenChange={setBagOpen} />
    </div>
  );
}
