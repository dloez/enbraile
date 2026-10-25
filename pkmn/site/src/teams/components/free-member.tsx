import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import type { StatID } from "@pkmn/dex";
import { SelectField } from "@/components/select-field";
import { MonSprite } from "@/components/pc/mon-sprite";
import { SummaryHead, tint } from "@/components/pc/summary";
import { buttonVariants } from "@/components/ui/button";
import { Sheet as BottomSheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { buildPool, type PoolFilters } from "@/analysis/pool";
import { cn } from "@/lib/utils";
import { EditorHead, editorScroll } from "@/teams/components/editors";
import { displayName, type Mon, STAT_LABELS, STATS, TYPES } from "../../../shared/mon";
import { freeMon, NATURES, speciesAbilities } from "@/teams/dex";
import { freeSet, newFreeMember, type FreeMember, type FreeSet } from "@/teams/team";
import { EV_TOTAL, MAX_EV, MAX_IV, MAX_LEVEL } from "../../../shared/team";

export function poolSpecies(filters: PoolFilters): { id: string; name: string; types: string[] }[] {
  return buildPool(filters)
    .members.map((m) => ({ id: m.id, name: m.name, types: m.types }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function poolIds(filters: PoolFilters): Set<string> {
  return new Set(poolSpecies(filters).map((s) => s.id));
}

const SIGNS = (mon: Mon, stat: StatID) => {
  const n = mon.nature;
  const up = n?.plus === stat && n.minus !== stat;
  const down = n?.minus === stat && n.plus !== stat;
  return { ink: up ? "text-stat-up" : down ? "text-stat-down" : "text-muted-foreground", sign: up ? "+" : down ? "−" : "" };
};

const number = (raw: string, low: number, high: number) => Math.max(low, Math.min(high, Number.parseInt(raw, 10) || 0));

const field = "flex h-11 items-center gap-2 rounded-[10px] border-3 border-cell bg-box px-2.5";

const box = "h-8 w-full rounded-[7px] border-2 border-border bg-ink px-1.5 text-right font-heading text-xl text-foreground outline-none focus-visible:border-primary";

export function SetForm({ member, onChange }: { member: FreeMember; onChange: (set: Partial<FreeSet>) => void }) {
  const mon = freeMon(member);
  const total = STATS.reduce((sum, stat) => sum + member.evs[stat], 0);
  const grid = "grid-cols-[40px_minmax(0,1fr)_60px_50px_42px]";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <label className={field}>
          <span className="font-heading text-[1.1875rem] text-muted-foreground">Level</span>
          <input
            type="number"
            min={1}
            max={MAX_LEVEL}
            value={member.level}
            onChange={(event) => onChange({ level: number(event.target.value, 1, MAX_LEVEL) })}
            className="min-w-0 flex-1 bg-transparent text-right font-heading text-2xl text-foreground outline-none"
          />
        </label>
        <SelectField
          label="Nature"
          size="sm"
          value={member.nature}
          onChange={(nature) => onChange({ nature })}
          options={NATURES.map((n) => ({
            value: n.id,
            label: n.plus && n.minus ? `${n.name} (+${STAT_LABELS[n.plus]} −${STAT_LABELS[n.minus]})` : `${n.name} (neutral)`,
          }))}
          className="h-11! w-full"
        />
      </div>
      <div className={cn("grid items-center gap-x-2 px-1 font-heading text-[1.0625rem] text-muted-foreground", grid)}>
        <span />
        <span>Base</span>
        <span className="text-right">EVs</span>
        <span className="text-right">IVs</span>
        <span className="text-right">Lv {member.level}</span>
      </div>
      {(mon.stats ?? []).map((s) => {
        const { ink, sign } = SIGNS(mon, s.stat);
        return (
          <div key={s.stat} className={cn("grid min-h-10 items-center gap-x-2 rounded-lg bg-box px-1", grid)}>
            <span className={cn("font-heading text-[1.3125rem]", ink)}>
              {STAT_LABELS[s.stat]}
              {sign}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="block h-2.5 flex-1 overflow-hidden rounded-sm bg-ink">
                <span className={cn("block h-full", tint(s.base / 180))} style={{ width: `${Math.min(100, Math.round((s.base / 180) * 100))}%` }} />
              </span>
              <span className="w-7 flex-none text-right font-heading text-lg text-subtle">{s.base}</span>
            </span>
            <input
              type="number"
              aria-label={`${STAT_LABELS[s.stat]} EVs`}
              min={0}
              max={MAX_EV}
              step={4}
              value={member.evs[s.stat]}
              onChange={(event) => onChange({ evs: { ...member.evs, [s.stat]: number(event.target.value, 0, MAX_EV) } })}
              className={box}
            />
            <input
              type="number"
              aria-label={`${STAT_LABELS[s.stat]} IVs`}
              min={0}
              max={MAX_IV}
              value={member.ivs[s.stat]}
              onChange={(event) => onChange({ ivs: { ...member.ivs, [s.stat]: number(event.target.value, 0, MAX_IV) } })}
              className={box}
            />
            <span className="text-right font-heading text-2xl">{s.current}</span>
          </div>
        );
      })}
      <span className={cn("px-1 font-heading text-[1.1875rem]", total > EV_TOTAL ? "text-coral" : "text-muted-foreground")}>
        EVs {total} / {EV_TOTAL}
      </span>
    </div>
  );
}

export function SetEditor({ member, back, onBack, onChange }: { member: FreeMember; back: string; onBack: () => void; onChange: (set: Partial<FreeSet>) => void }) {
  return (
    <>
      <EditorHead who={displayName(freeMon(member))} what="level, nature, EVs, IVs" back={back} onBack={onBack} />
      <div className={editorScroll}>
        <SetForm member={member} onChange={onChange} />
      </div>
    </>
  );
}

function draftOf(species: string, set: FreeSet): FreeMember {
  const abilities = speciesAbilities(species);
  return newFreeMember(species, abilities.base[0] ?? abilities.hidden[0] ?? null, set);
}

function Aside({ member, onChange, footer }: { member: FreeMember; onChange: (set: Partial<FreeSet>) => void; footer: ReactNode }) {
  const mon = freeMon(member);
  return (
    <>
      <SummaryHead mon={mon} title={(text) => <h2 className="m-0 truncate font-heading text-[2.25rem] leading-[0.85] font-normal">{text}</h2>} />
      <p className="m-0 flex-none px-4 pt-2 font-heading text-[1.1875rem] text-subtle">Free member</p>
      <div className={cn(editorScroll, "mr-0 px-4 py-2.5")}>
        <SetForm member={member} onChange={onChange} />
      </div>
      {footer}
    </>
  );
}

export function FreePicker({ slot, wide, pool, onPut }: { slot: number; wide: boolean; pool: PoolFilters; onPut: (member: FreeMember) => void }) {
  const species = useMemo(() => poolSpecies(pool), [pool]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [set, setSet] = useState<FreeSet>(() => freeSet());
  const q = query.trim().toLowerCase();
  const shown = species.filter((s) => (!q || s.name.toLowerCase().includes(q)) && (!type || s.types.includes(type)));
  const chosen = picked ?? (wide ? (shown[0] ?? species[0])?.id ?? null : null);
  const draft = chosen ? draftOf(chosen, set) : null;
  const sprites = useMemo(() => new Map(species.map((s) => [s.id, freeMon(draftOf(s.id, freeSet()))])), [species]);
  const change = (next: Partial<FreeSet>) => setSet({ ...set, ...next });

  const footer = draft && (
    <div className="flex-none border-t-3 px-4.5 py-3.5">
      <button
        type="button"
        onClick={() => {
          onPut(draft);
          setPicked(null);
          setSet(freeSet());
        }}
        className={buttonVariants({ variant: "go", className: "min-h-13 w-full rounded-[10px] text-[1.625rem]" })}
      >
        Put in slot {slot + 1}
      </button>
    </div>
  );

  return (
    <>
      <section aria-label="Species" className="flex min-w-0 flex-1 flex-col gap-3 rounded-[18px] border-3 bg-card p-3.5 text-foreground lg:min-h-0">
        <div className="flex min-h-12 flex-none flex-wrap items-center gap-3">
          <span className="pl-1 font-heading text-[1.875rem] leading-none">{shown.length} species</span>
          <span className="font-heading text-xl text-muted-foreground max-sm:hidden">Gen 9 data · species up to Gen 5 · fully evolved</span>
          <div className="flex-1" />
          <label className="flex h-12 flex-[1_1_100%] items-center gap-2 rounded-[10px] border-3 bg-ink px-3 focus-within:border-primary sm:max-w-55 sm:flex-[1_1_160px]">
            <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Search species</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <SelectField label="Type" value={type} onChange={setType} all="All types" options={TYPES.map((t) => ({ value: t, label: t }))} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-box px-3 py-3.5 [scrollbar-color:var(--cell-hi)_transparent] [scrollbar-width:thin]">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(106px,1fr))]">
            {shown.map((s) => {
              const on = s.id === chosen;
              const mon = sprites.get(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.name}
                  aria-pressed={on}
                  title={s.name}
                  onClick={() => setPicked(s.id)}
                  className={cn(
                    "grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border-none p-0 outline-none hover:shadow-[inset_0_0_0_3px_var(--cyan)] focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? "bg-pc-cell-on shadow-[inset_0_0_0_3px_var(--cyan)]" : "bg-pc-cell",
                  )}
                >
                  {mon && <MonSprite mon={mon} className="pointer-events-none w-[92%] sm:size-24" />}
                </button>
              );
            })}
          </div>
          {shown.length === 0 && <p className="my-10 text-center font-heading text-[1.625rem] text-prose">Nothing matches</p>}
        </div>
      </section>
      {wide && draft && (
        <aside aria-label="New free member" className="flex w-95 flex-none flex-col overflow-hidden rounded-[18px] border-3 bg-card lg:min-h-0">
          <Aside member={draft} onChange={change} footer={footer} />
        </aside>
      )}
      {!wide && (
        <BottomSheet open={draft !== null} onOpenChange={(next) => !next && setPicked(null)}>
          <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[90svh] gap-0 overflow-hidden rounded-t-2xl bg-card">
            <SheetTitle className="sr-only">New free member</SheetTitle>
            {draft && <Aside member={draft} onChange={change} footer={footer} />}
          </SheetContent>
        </BottomSheet>
      )}
    </>
  );
}
