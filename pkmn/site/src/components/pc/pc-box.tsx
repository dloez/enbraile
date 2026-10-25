import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { TYPES } from "@/analysis/dex";
import { buttonClass } from "@/components/controls";
import { Bag } from "@/components/pc/bag";
import { MonSprite, SummaryBody, SummaryHead } from "@/components/pc/summary";
import { Sheet as BottomSheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { describePokemon, displayName, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import type { ExportGap } from "../../../shared/snapshot";

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
        "relative grid aspect-square cursor-pointer snap-start place-items-center overflow-hidden rounded-xl border-none p-0 outline-none hover:shadow-[inset_0_0_0_3px_var(--cyan)] focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "bg-pc-cell-on shadow-[inset_0_0_0_3px_var(--cyan)]" : "bg-pc-cell",
      )}
    >
      <MonSprite mon={mon} className="pointer-events-none w-[92%] sm:size-24" />
      <span className="absolute top-0.5 left-2 font-heading text-xl text-foreground [text-shadow:0_2px_0_var(--ink)]">{mon.level ?? "?"}</span>
      {mon.shiny && (
        <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className="absolute top-1.25 right-1.5 size-3 fill-yellow">
          <path d="M3 0h1v2H3zM0 3h2v1H0zM5 3h2v1H5zM3 5h1v2H3zM2 2h3v3H2z" />
        </svg>
      )}
      {mon.species.marked && <span className="absolute right-1.5 bottom-0.5 font-heading text-lg text-destructive">?</span>}
    </button>
  );
}

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--pc-check) 25%, transparent 25%, transparent 75%, var(--pc-check) 75%), linear-gradient(45deg, var(--pc-check) 25%, transparent 25%, transparent 75%, var(--pc-check) 75%)",
  backgroundSize: "56px 56px",
  backgroundPosition: "0 0, 28px 28px",
};

function ScrollMore({ dir, onClick }: { dir: "up" | "down"; onClick: () => void }) {
  const up = dir === "up";
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 from-pc-fade to-transparent",
          up ? "top-0 h-16 bg-linear-to-b" : "bottom-0 h-18 bg-linear-to-t",
        )}
      />
      <button
        type="button"
        aria-label={up ? "Scroll up" : "Scroll down"}
        onClick={onClick}
        className={cn(
          "absolute left-1/2 grid h-9 w-14 -translate-x-1/2 cursor-pointer place-items-center rounded-[10px] border-3 bg-ink/85 outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
          up ? "top-2" : "bottom-2",
        )}
      >
        <svg
          viewBox="0 0 10 6"
          shapeRendering="crispEdges"
          aria-hidden="true"
          className={cn("pc-nudge h-3 w-5 fill-primary", up ? "animate-pc-nudge-up" : "animate-pc-nudge-down")}
        >
          <path d={up ? "M4 0h2v1H4zM3 1h4v1H3zM2 2h6v1H2zM1 3h8v1H1zM0 4h10v1H0z" : "M0 0h10v1H0zM1 1h8v1H1zM2 2h6v1H2zM3 3h4v1H3zM4 4h2v1H4z"} />
        </svg>
      </button>
    </>
  );
}

export function BagButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className={cn(buttonClass, "min-h-12")}>
      <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" className="size-4 fill-primary">
        <path d="M3 0h4v1H3zM2 1h1v2H2zM7 1h1v2H7zM1 3h8v1H1zM0 4h10v5H0zM1 9h8v1H1z" />
      </svg>
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
  const [edges, setEdges] = useState({ up: false, down: false });
  const list = useRef<HTMLDivElement>(null);
  const shown = mons.filter((mon) => matches(mon, query, type));
  const filtering = query.trim() !== "" || type !== "";
  const measure = useCallback(() => {
    const el = list.current;
    if (!el) return;
    const next = { up: el.scrollTop > 4, down: el.scrollTop + el.clientHeight < el.scrollHeight - 4 };
    setEdges((now) => (now.up === next.up && now.down === next.down ? now : next));
  }, []);
  useEffect(() => {
    measure();
    const el = list.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, shown.length]);
  const page = (dir: number) => {
    const el = list.current;
    if (el) el.scrollBy({ top: dir * Math.max(112, el.clientHeight - 112), behavior: "smooth" });
  };
  return (
    <section aria-label="Pokémon" className="flex min-w-0 flex-1 flex-col gap-3 rounded-[18px] border-3 bg-card p-3.5 text-foreground lg:min-h-0">
      <div className="flex min-h-12 flex-none flex-wrap items-center gap-3">
        <span className="pl-1 font-heading text-[1.875rem] leading-none">
          {filtering ? `${shown.length} of ${mons.length} Pokémon` : `${mons.length} Pokémon`}
        </span>
        <div className="flex-1" />
        <label className="flex h-12 flex-[1_1_100%] items-center sm:max-w-55 sm:flex-[1_1_160px] gap-2 rounded-[10px] border-3 bg-ink px-3 focus-within:border-primary">
          <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search Pokémon</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <label className="flex h-12 items-center rounded-[10px] border-3 bg-ink pr-2 pl-3 focus-within:border-primary">
          <span className="sr-only">Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="cursor-pointer bg-transparent pr-1 font-heading text-[1.375rem] text-foreground outline-none"
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
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl bg-pc" style={CHECKER}>
        <div
          ref={list}
          onScroll={measure}
          className="min-h-0 flex-1 snap-y snap-proximity scroll-py-3.5 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-3.5 pb-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(106px,1fr))]">
            {shown.map((mon) => (
              <Cell key={mon.index} mon={mon} selected={mon.index === selected} onPick={() => onPick(mon.index)} />
            ))}
          </div>
          {shown.length === 0 && <p className="my-10 text-center font-heading text-[1.625rem] text-prose">Nothing matches</p>}
        </div>
        {edges.up && <ScrollMore dir="up" onClick={() => page(-1)} />}
        {edges.down && <ScrollMore dir="down" onClick={() => page(1)} />}
      </div>
    </section>
  );
}

export function SummaryAside({ mon, sheet, footer, gaps }: { mon: Mon; sheet: Sheet; footer?: ReactNode; gaps?: readonly ExportGap[] }) {
  return (
    <aside
      aria-label="Summary"
      className="sticky top-4 flex max-h-[calc(100svh-2rem)] w-95 flex-none flex-col self-start overflow-hidden rounded-[18px] border-3 bg-card lg:min-h-0 lg:self-stretch"
    >
      <SummaryHead mon={mon} title={(text) => <h2 className="m-0 truncate font-heading text-[2.625rem] leading-[0.85] font-normal">{text}</h2>} />
      <SummaryBody key={mon.index} mon={mon} sheet={sheet} gaps={gaps} />
      {footer}
    </aside>
  );
}

export function SummarySheet({ mon, sheet, open, onClose, footer, gaps }: {
  mon: Mon | undefined;
  sheet: Sheet;
  gaps?: readonly ExportGap[];
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[90svh] gap-0 overflow-hidden rounded-t-2xl bg-card">
        {mon && (
          <>
            <SummaryHead
              mon={mon}
              closeRoom
              title={(text) => <SheetTitle className="truncate font-heading text-[2.25rem] leading-[0.85] font-normal">{text}</SheetTitle>}
            />
            <SummaryBody key={mon.index} mon={mon} sheet={sheet} gaps={gaps} />
            {footer}
          </>
        )}
      </SheetContent>
    </BottomSheet>
  );
}

export function SnapshotPc({ sheet, gaps = [] }: { sheet: Sheet; gaps?: readonly ExportGap[] }) {
  const wide = useMediaQuery("(min-width: 64rem)");
  const mons = useMemo(() => sheet.pokemon.map(describePokemon), [sheet]);
  const [picked, setPicked] = useState<number | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const selected = picked ?? (wide ? 0 : null);
  const selectedMon = selected === null ? undefined : mons[selected];

  return (
    <>
      <div className="flex flex-1 gap-6 pt-3.5 pb-3 sm:pb-6 lg:min-h-0">
        <PcBox mons={mons} selected={selected} onPick={setPicked} actions={<BagButton onClick={() => setBagOpen(true)} />} />
        {wide && selectedMon && <SummaryAside mon={selectedMon} sheet={sheet} gaps={gaps} />}
      </div>
      {!wide && <SummarySheet mon={selectedMon} sheet={sheet} gaps={gaps} open={selectedMon !== undefined} onClose={() => setPicked(null)} />}
      <Bag sheet={sheet} gaps={gaps} open={bagOpen} onOpenChange={setBagOpen} />
    </>
  );
}
