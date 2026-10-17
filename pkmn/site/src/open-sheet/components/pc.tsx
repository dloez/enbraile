import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { createTeam, deleteTeam, duplicateTeam, renameTeam, saveSlots, useTeams, type StoredTeam } from "@/open-sheet/db";
import { TYPES } from "@/analysis/dex";
import { currentAbility, describePokemon, displayName, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import {
  addMember,
  giveItem,
  liveSlots,
  memberMon,
  removeMember,
  setAbility,
  setMove,
  slotOf,
  takeItem,
  teach,
  type Slots,
} from "@/open-sheet/team";
import { Bag } from "@/open-sheet/components/bag";
import { MonSprite, SummaryBody, SummaryHead } from "@/open-sheet/components/summary";
import { TeamBar, type View } from "@/open-sheet/components/team-bar";
import { TeamStrip } from "@/open-sheet/components/team-strip";
import { TeamView } from "@/open-sheet/components/team-view";
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

function AddButton({ slots, mons, mon, onChange, className }: {
  slots: Slots;
  mons: readonly Mon[];
  mon: Mon;
  onChange: (slots: Slots) => void;
  className?: string;
}) {
  const at = slotOf(slots, mons, mon.index);
  const added = at < 0 ? addMember(slots, mon) : null;
  const full = at < 0 && added === null;
  return (
    <div className={cn("flex-none border-t", className)}>
      <button
        type="button"
        disabled={full}
        onClick={() => onChange(at >= 0 ? removeMember(slots, at) : (added ?? slots))}
        className={cn(
          "min-h-11 w-full cursor-pointer rounded-[10px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50",
          at >= 0 ? "border bg-transparent text-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {at >= 0 ? "Remove from team" : full ? "Team full" : "Add to team"}
      </button>
    </div>
  );
}

export function Pc({ tabId, sheet }: { tabId: number; sheet: Sheet }) {
  const teams = useTeams(tabId);
  const [teamId, setTeamId] = useState<number | null>(null);
  if (teams === null) {
    return (
      <p role="alert" className="mx-auto my-10 max-w-180 px-4 text-destructive">
        This browser will not let the site store teams.
      </p>
    );
  }
  const team = teams?.find((t) => t.id === teamId) ?? teams?.[0];
  if (!teams || !team) return <div className="flex-1" />;
  return <TeamPc sheet={sheet} teams={teams} team={team} onTeam={setTeamId} />;
}

function TeamPc({ sheet, teams, team, onTeam }: {
  sheet: Sheet;
  teams: StoredTeam[];
  team: StoredTeam;
  onTeam: (id: number) => void;
}) {
  const wide = useMediaQuery("(min-width: 64rem)");
  const mons = useMemo(() => sheet.pokemon.map(describePokemon), [sheet]);
  const [view, setView] = useState<View>("pc");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [giveTo, setGiveTo] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ id: number; slots: Slots } | null>(null);
  const pending = useRef(0);
  useEffect(() => {
    if (pending.current === 0) setDraft(null);
  }, [team.slots]);
  const stored = draft?.id === team.id ? draft.slots : team.slots;
  const slots = useMemo(() => liveSlots(stored, mons), [stored, mons]);

  const shown = mons.filter((mon) => matches(mon, query, type));
  const selected = picked ?? (wide ? 0 : null);
  const selectedMon = selected === null ? undefined : mons[selected];

  function save(next: Slots) {
    setDraft({ id: team.id, slots: next });
    pending.current += 1;
    void saveSlots(team.id, next).finally(() => {
      pending.current -= 1;
    });
  }

  function openBag(slot: number | null) {
    setGiveTo(slot);
    setBagOpen(true);
  }

  function given(next: Slots | null) {
    if (next) save(next);
    setBagOpen(false);
    setGiveTo(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-6">
        <TeamBar
          view={view}
          onView={setView}
          teams={teams}
          team={team}
          onPick={onTeam}
          onCreate={() => void createTeam(team.tabId).then(onTeam)}
          onDuplicate={() => void duplicateTeam(team.id).then((id) => id !== undefined && onTeam(id))}
          onRename={(name) => void renameTeam(team.id, name)}
          onDelete={() => void deleteTeam(team.id).then(() => onTeam(teams.find((t) => t.id !== team.id)?.id ?? -1))}
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => openBag(null)}
          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 py-2 font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ShoppingBag className="size-4.5" aria-hidden="true" />
          Bag
        </button>
      </div>
      {view === "team" ? (
        <TeamView
          sheet={sheet}
          name={team.name}
          slots={slots}
          mons={mons}
          onOpen={(index) => {
            setPicked(index);
            setView("pc");
          }}
          onRemove={(slot) => save(removeMember(slots, slot))}
          onItem={(slot) => openBag(slot)}
          onTakeItem={(slot) => save(takeItem(slots, slot))}
          onAbility={(slot, ability) => {
            const mon = memberMon(slots[slot], mons);
            if (mon) save(setAbility(slots, slot, ability, currentAbility(mon)));
          }}
          onMove={(slot, at, move) => save(setMove(slots, slot, at, move))}
          onAdd={() => setView("pc")}
        />
      ) : (
        <>
          <TeamStrip slots={slots} mons={mons} selected={selected} onPick={setPicked} />
          <div className="flex flex-1 gap-4 px-3 pt-3.5 pb-3 sm:px-6 sm:pb-6">
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 px-3.5 pb-3.5 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
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
                <SummaryBody key={selectedMon.index} mon={selectedMon} sheet={sheet} />
                <AddButton slots={slots} mons={mons} mon={selectedMon} onChange={save} className="px-4.5 py-3.5" />
              </aside>
            )}
          </div>
        </>
      )}
      {!wide && (
        <BottomSheet open={view === "pc" && selectedMon !== undefined} onOpenChange={(open) => !open && setPicked(null)}>
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
                <SummaryBody key={selectedMon.index} mon={selectedMon} sheet={sheet} />
                <AddButton
                  slots={slots}
                  mons={mons}
                  mon={selectedMon}
                  onChange={(next) => {
                    save(next);
                    setPicked(null);
                  }}
                  className="px-4 pt-3 pb-5"
                />
              </>
            )}
          </SheetContent>
        </BottomSheet>
      )}
      <Bag
        sheet={sheet}
        open={bagOpen}
        onOpenChange={(open) => {
          setBagOpen(open);
          if (!open) setGiveTo(null);
        }}
        slots={slots}
        mons={mons}
        giveTo={giveTo}
        onGive={(slot, item) => given(giveItem(sheet, slots, slot, item))}
        onTeach={(slot, move) => given(teach(slots, slot, move))}
      />
    </div>
  );
}
