import { useMemo, useState, type ReactNode } from "react";
import { Search, ShoppingBag } from "lucide-react";
import { TYPES } from "@/analysis/dex";
import { buttonClass } from "@/components/controls";
import { Bag } from "@/components/pc/bag";
import { MonSprite, SummaryBody, SummaryHead } from "@/components/pc/summary";
import { Sheet as BottomSheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { describePokemon, displayName, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";

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
        "relative grid aspect-square cursor-pointer place-items-center rounded-lg border-2 p-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-primary bg-cell-hi" : "border-transparent bg-cell",
      )}
    >
      <MonSprite mon={mon} className="pointer-events-none w-[92%]" />
      <span className="absolute top-1 left-1.25 tabular-nums text-xs text-muted-foreground">{mon.level ?? "?"}</span>
      {mon.species.marked && <span className="absolute top-0.5 right-1.5 text-xs font-bold text-destructive">?</span>}
      <span className="absolute inset-x-1 bottom-0.75 hidden truncate text-center text-xs sm:block">{displayName(mon)}</span>
    </button>
  );
}

export function BagButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className={buttonClass}>
      <ShoppingBag className="size-4.5" aria-hidden="true" />
      Bag
    </button>
  );
}

export function PcBox({ mons, selected, onPick, actions }: {
  mons: readonly Mon[];
  selected: number | null;
  onPick: (index: number) => void;
  actions?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const shown = mons.filter((mon) => matches(mon, query, type));
  return (
    <section aria-label="PC" className="flex min-w-0 flex-1 flex-col self-start rounded-2xl bg-box text-foreground">
      <div className="flex flex-none flex-wrap items-center gap-2.5 px-3.5 py-3">
        <span className="font-heading text-2xl tracking-[0.04em]">
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
        {actions}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 px-3.5 pb-3.5 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
        {shown.map((mon) => (
          <Cell key={mon.index} mon={mon} selected={mon.index === selected} onPick={() => onPick(mon.index)} />
        ))}
      </div>
    </section>
  );
}

export function SummaryAside({ mon, sheet, footer }: { mon: Mon; sheet: Sheet; footer?: ReactNode }) {
  return (
    <aside
      aria-label="Summary"
      className="sticky top-4 flex max-h-[calc(100svh-2rem)] w-100 flex-none flex-col self-start overflow-hidden rounded-2xl border-3 bg-card"
    >
      <div className="flex flex-none items-center px-4.5 pt-4">
        <SummaryHead mon={mon} title={(text) => <h2 className="m-0 font-heading text-3xl leading-[1.1]">{text}</h2>} />
      </div>
      <SummaryBody key={mon.index} mon={mon} sheet={sheet} />
      {footer}
    </aside>
  );
}

export function SummarySheet({ mon, sheet, open, onClose, footer }: {
  mon: Mon | undefined;
  sheet: Sheet;
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[90svh] gap-0 overflow-hidden rounded-t-2xl bg-card">
        {mon && (
          <>
            <div className="flex flex-none items-center pt-4 pr-12 pl-4">
              <SummaryHead
                mon={mon}
                title={(text) => <SheetTitle className="font-heading text-2xl leading-[1.1]">{text}</SheetTitle>}
              />
            </div>
            <SummaryBody key={mon.index} mon={mon} sheet={sheet} />
            {footer}
          </>
        )}
      </SheetContent>
    </BottomSheet>
  );
}

export function SnapshotPc({ sheet }: { sheet: Sheet }) {
  const wide = useMediaQuery("(min-width: 64rem)");
  const mons = useMemo(() => sheet.pokemon.map(describePokemon), [sheet]);
  const [picked, setPicked] = useState<number | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const selected = picked ?? (wide ? 0 : null);
  const selectedMon = selected === null ? undefined : mons[selected];

  return (
    <>
      <div className="flex flex-1 gap-4 pt-3.5 pb-3 sm:pb-6">
        <PcBox mons={mons} selected={selected} onPick={setPicked} actions={<BagButton onClick={() => setBagOpen(true)} />} />
        {wide && selectedMon && <SummaryAside mon={selectedMon} sheet={sheet} />}
      </div>
      {!wide && <SummarySheet mon={selectedMon} sheet={sheet} open={selectedMon !== undefined} onClose={() => setPicked(null)} />}
      <Bag sheet={sheet} open={bagOpen} onOpenChange={setBagOpen} />
    </>
  );
}
