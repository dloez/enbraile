import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { buttonClass, Toggle } from "@/components/controls";
import { ComboField, type ComboOption } from "@/components/combo-field";
import { SelectField } from "@/components/select-field";
import { Bag } from "@/components/pc/bag";
import { MonSprite } from "@/components/pc/mon-sprite";
import { SummaryBody, SummaryHead } from "@/components/pc/summary";
import { Sheet as BottomSheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { typeLabel } from "../../../shared/dex-text";
import { messages } from "../../../shared/i18n";
import { displayName, TYPES, type Ability, type BagItem, type BagTm, type Mon } from "../../../shared/mon";
import type { ExportGap } from "../../../shared/snapshot";

const t = messages({
  en: {
    cell: (name: string, species: string, level: number | null, fainted: boolean, taken: boolean) =>
      `${name}, ${species}, level ${level ?? "unknown"}${fainted ? ", fainted" : ""}${taken ? ", in the team" : ""}`,
    hideFainted: "Hide the fainted Pokémon",
    showFainted: "Show the fainted Pokémon",
    fainted: (n: number) => `Fainted · ${n}`,
    scrollUp: "Scroll up",
    scrollDown: "Scroll down",
    bag: "Bag",
    box: "Pokémon",
    count: (n: number) => `${n} Pokémon`,
    countOf: (shown: number, all: number) => `${shown} of ${all} Pokémon`,
    searchLabel: "Search Pokémon",
    search: "Search",
    type: "Type",
    allTypes: "All types",
    ability: "Ability",
    allAbilities: "All abilities",
    showAll: "Show every Pokémon that can have it",
    showUsing: "Show only the Pokémon using it",
    inUse: "In use",
    nothing: "Nothing matches",
    summary: "Summary",
  },
  es: {
    cell: (name: string, species: string, level: number | null, fainted: boolean, taken: boolean) =>
      `${name}, ${species}, nivel ${level ?? "desconocido"}${fainted ? ", debilitado" : ""}${taken ? ", en el equipo" : ""}`,
    hideFainted: "Ocultar los Pokémon debilitados",
    showFainted: "Mostrar los Pokémon debilitados",
    fainted: (n: number) => `Debilitados · ${n}`,
    scrollUp: "Subir",
    scrollDown: "Bajar",
    bag: "Mochila",
    box: "Pokémon",
    count: (n: number) => `${n} Pokémon`,
    countOf: (shown: number, all: number) => `${shown} de ${all} Pokémon`,
    searchLabel: "Buscar Pokémon",
    search: "Buscar",
    type: "Tipo",
    allTypes: "Todos los tipos",
    ability: "Habilidad",
    allAbilities: "Todas las habilidades",
    showAll: "Mostrar todos los Pokémon que pueden tenerla",
    showUsing: "Mostrar solo los Pokémon que la usan",
    inUse: "En uso",
    nothing: "No hay coincidencias",
    summary: "Resumen",
  },
});

export type BoxMon = Pick<Mon, "index" | "species" | "nickname" | "level" | "shiny" | "fainted" | "filterTypes" | "sprite"> & {
  abilities: readonly Pick<Ability, "id" | "name" | "current">[];
};

function matches(mon: BoxMon, query: string, type: string, ability: string, inUse: boolean): boolean {
  const q = query.trim().toLowerCase();
  const named = !q || mon.species.name.toLowerCase().includes(q) || (mon.nickname ?? "").toLowerCase().includes(q);
  const held = mon.abilities.find((a) => a.id === ability);
  return named && (!type || mon.filterTypes.includes(type)) && (!ability || (held !== undefined && (!inUse || held.current)));
}

function abilityOptions(mons: readonly BoxMon[]): ComboOption[] {
  const found = new Map<string, ComboOption & { count: number }>();
  for (const mon of mons) {
    for (const a of mon.abilities) {
      const entry = found.get(a.id) ?? { value: a.id, label: a.name, count: 0 };
      entry.count += 1;
      found.set(a.id, entry);
    }
  }
  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function Cell({ mon, selected, taken, mark, onPick }: { mon: BoxMon; selected: boolean; taken: boolean; mark?: ReactNode; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={t.cell(displayName(mon), mon.species.name, mon.level, mon.fainted, taken)}
      aria-pressed={selected}
      className={cn(
        "relative grid aspect-square cursor-pointer snap-start place-items-center overflow-hidden rounded-xl border-none p-0 outline-none hover:shadow-[inset_0_0_0_3px_var(--cyan)] focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "bg-pc-cell-on shadow-[inset_0_0_0_3px_var(--cyan)]" : "bg-pc-cell",
        taken && "opacity-45",
      )}
    >
      <MonSprite mon={mon} className={cn("pointer-events-none w-[92%] sm:size-24", mon.fainted && "opacity-60 grayscale")} />
      <span className="absolute top-0.5 left-2 font-heading text-xl text-foreground [text-shadow:0_2px_0_var(--ink)]">{mon.level ?? "?"}</span>
      {mon.shiny && (
        <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className="absolute top-1.25 right-1.5 size-3 fill-yellow">
          <path d="M3 0h1v2H3zM0 3h2v1H0zM5 3h2v1H5zM3 5h1v2H3zM2 2h3v3H2z" />
        </svg>
      )}
      {mon.species.marked && <span className="absolute right-1.5 bottom-0.5 font-heading text-lg text-destructive">?</span>}
      {mon.fainted && <FaintedMark className="absolute bottom-1 left-1.5" />}
      {mark && <span className="absolute bottom-1.5 left-1.5 flex">{mark}</span>}
    </button>
  );
}

export function FaintedMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={cn("size-3.5 fill-destructive", className)}>
      <path d="M0 0h2v1H0zM5 0h2v1H5zM1 1h2v1H1zM4 1h2v1H4zM2 2h3v1H2zM3 3h1v1H3zM2 4h3v1H2zM1 5h2v1H1zM4 5h2v1H4zM0 6h2v1H0zM5 6h2v1H5z" />
    </svg>
  );
}

export function FaintedToggle({ count, shown, onChange }: { count: number; shown: boolean; onChange: (shown: boolean) => void }) {
  return (
    <Toggle pressed={shown} onChange={onChange} title={shown ? t.hideFainted : t.showFainted}>
      <FaintedMark className={shown ? "fill-current" : undefined} />
      {t.fainted(count)}
    </Toggle>
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
        aria-label={up ? t.scrollUp : t.scrollDown}
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
      {t.bag}
    </button>
  );
}

export function PcBox<M extends BoxMon>({ mons, selected, onPick, actions, filters, filter, mark, taken, ability: shownAbility, onAbility }: {
  mons: readonly M[];
  selected: number | null;
  onPick: (index: number) => void;
  actions?: ReactNode;
  filters?: ReactNode;
  filter?: (mon: M) => boolean;
  mark?: (mon: M) => ReactNode;
  taken?: ReadonlySet<number>;
  ability?: string;
  onAbility?: (ability: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [ownAbility, setOwnAbility] = useState("");
  const [inUse, setInUse] = useState(false);
  const ability = shownAbility ?? ownAbility;
  const chooseAbility = onAbility ?? setOwnAbility;
  const abilities = useMemo(() => abilityOptions(mons), [mons]);
  const shown = mons.filter((mon) => matches(mon, query, type, ability, inUse) && (!filter || filter(mon)));
  const filtering = shown.length !== mons.length;
  const [edges, setEdges] = useState({ up: false, down: false });
  const list = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    list.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
  }, []);
  const page = (dir: number) => {
    const el = list.current;
    if (el) el.scrollBy({ top: dir * Math.max(112, el.clientHeight - 112), behavior: "smooth" });
  };
  return (
    <section aria-label={t.box} className="flex min-w-0 flex-1 flex-col gap-3 rounded-[18px] border-3 bg-card p-3.5 text-foreground lg:min-h-0">
      <div className="flex min-h-12 flex-none flex-wrap items-center gap-3">
        <span className="pl-1 font-heading text-[1.875rem] leading-none">
          {filtering ? t.countOf(shown.length, mons.length) : t.count(mons.length)}
        </span>
        <div className="flex-1" />
        <label className="flex h-12 flex-[1_1_100%] items-center sm:max-w-55 sm:flex-[1_1_160px] gap-2 rounded-[10px] border-3 bg-ink px-3 focus-within:border-primary">
          <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <SelectField label={t.type} value={type} onChange={setType} all={t.allTypes} options={TYPES.map((name) => ({ value: name, label: typeLabel(name) }))} />
        <ComboField label={t.ability} value={ability} onChange={chooseAbility} all={t.allAbilities} options={abilities} className="max-w-55" />
        {ability !== "" && (
          <Toggle pressed={inUse} onChange={setInUse} title={inUse ? t.showAll : t.showUsing}>
            {t.inUse}
          </Toggle>
        )}
        {filters}
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
              <Cell key={mon.index} mon={mon} selected={mon.index === selected} taken={taken?.has(mon.index) ?? false} mark={mark?.(mon)} onPick={() => onPick(mon.index)} />
            ))}
          </div>
          {shown.length === 0 && <p className="my-10 text-center font-heading text-[1.625rem] text-prose">{t.nothing}</p>}
        </div>
        {edges.up && <ScrollMore dir="up" onClick={() => page(-1)} />}
        {edges.down && <ScrollMore dir="down" onClick={() => page(1)} />}
      </div>
    </section>
  );
}

export function SummaryAside({ mon, tms, footer, gaps, series }: { mon: Mon; tms: readonly BagTm[]; footer?: ReactNode; gaps?: readonly ExportGap[]; series?: number }) {
  return (
    <aside
      aria-label={t.summary}
      className="sticky top-4 flex max-h-[calc(100svh-2rem)] w-95 flex-none flex-col self-start overflow-hidden rounded-[18px] border-3 bg-card lg:min-h-0 lg:self-stretch"
    >
      <SummaryHead mon={mon} title={(text) => <h2 className="m-0 truncate font-heading text-[2.625rem] leading-[0.85] font-normal">{text}</h2>} />
      <SummaryBody key={mon.index} mon={mon} tms={tms} gaps={gaps} series={series} />
      {footer}
    </aside>
  );
}

export function SummarySheet({ mon, tms, open, onClose, footer, gaps, series }: {
  mon: Mon | undefined;
  tms: readonly BagTm[];
  gaps?: readonly ExportGap[];
  series?: number;
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
            <SummaryBody key={mon.index} mon={mon} tms={tms} gaps={gaps} series={series} />
            {footer}
          </>
        )}
      </SheetContent>
    </BottomSheet>
  );
}

export function SnapshotPc({ mons, items, tms, setas, money, gaps = [], footer, series, initial }: {
  mons: readonly Mon[];
  series?: number;
  initial?: number;
  items: readonly BagItem[];
  tms: readonly BagTm[];
  setas: number | null;
  money: number | null;
  gaps?: readonly ExportGap[];
  footer?: (mon: Mon, done: () => void) => ReactNode;
}) {
  const wide = useMediaQuery("(min-width: 64rem)");
  const [picked, setPicked] = useState<number | null>(() => (initial !== undefined && mons.some((mon) => mon.index === initial) ? initial : null));
  const [bagOpen, setBagOpen] = useState(false);
  const [showFainted, setShowFainted] = useState(false);
  const faintedCount = mons.filter((mon) => mon.fainted).length;
  const shown = showFainted ? mons : mons.filter((mon) => !mon.fainted);
  const selectedMon = shown.find((mon) => mon.index === picked) ?? (wide ? shown[0] : undefined);
  const selected = selectedMon?.index ?? null;

  return (
    <>
      <div className="flex flex-1 gap-6 pt-3.5 pb-3 sm:pb-6 lg:min-h-0">
        <PcBox
          mons={shown}
          selected={selected}
          onPick={setPicked}
          actions={
            <>
              {faintedCount > 0 && <FaintedToggle count={faintedCount} shown={showFainted} onChange={setShowFainted} />}
              <BagButton onClick={() => setBagOpen(true)} />
            </>
          }
        />
        {wide && selectedMon && <SummaryAside mon={selectedMon} tms={tms} gaps={gaps} series={series} footer={footer?.(selectedMon, () => undefined)} />}
      </div>
      {!wide && (
        <SummarySheet
          mon={selectedMon}
          tms={tms}
          gaps={gaps}
          series={series}
          open={selectedMon !== undefined}
          onClose={() => setPicked(null)}
          footer={selectedMon && footer?.(selectedMon, () => setPicked(null))}
        />
      )}
      <Bag items={items} tms={tms} setas={setas} money={money} gaps={gaps} open={bagOpen} onOpenChange={setBagOpen} />
    </>
  );
}
