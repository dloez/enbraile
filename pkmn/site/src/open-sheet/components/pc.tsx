import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "@/components/controls";
import { messageWidth } from "@/components/page";
import { Bag } from "@/components/pc/bag";
import { BagButton, PcBox, SummaryAside, SummarySheet } from "@/components/pc/pc-box";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { createTeam, deleteTeam, duplicateTeam, renameTeam, saveSlots, useTeams, type StoredTeam } from "@/open-sheet/db";
import { currentAbility, describePokemon, type Mon } from "@/open-sheet/dex";
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
import { PasteDialog } from "@/open-sheet/components/paste-dialog";
import { TeamBar, type View } from "@/open-sheet/components/team-bar";
import { TeamStrip } from "@/open-sheet/components/team-strip";
import { TeamView } from "@/open-sheet/components/team-view";

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
        className={cn(buttonClass, "w-full")}
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
      <p role="alert" className={cn(messageWidth, "my-10 text-destructive")}>
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
  const [picked, setPicked] = useState<number | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [giveTo, setGiveTo] = useState<number | null>(null);
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState<{ id: number; slots: Slots } | null>(null);
  const pending = useRef(0);
  useEffect(() => {
    if (pending.current === 0) setDraft(null);
  }, [team.slots]);
  const stored = draft?.id === team.id ? draft.slots : team.slots;
  const slots = useMemo(() => liveSlots(stored, mons), [stored, mons]);

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
      <div className="flex flex-none flex-wrap items-center gap-2.5 py-2.5">
        <TeamBar
          view={view}
          onView={setView}
          teams={teams}
          team={team}
          onPick={onTeam}
          onCreate={() => void createTeam(team.tabId).then(onTeam)}
          onDuplicate={() => void duplicateTeam(team.id).then((id) => id !== undefined && onTeam(id))}
          onPaste={() => setPasting(true)}
          onRename={(name) => void renameTeam(team.id, name)}
          onDelete={() => void deleteTeam(team.id).then(() => onTeam(teams.find((t) => t.id !== team.id)?.id ?? -1))}
        />
        <div className="flex-1" />
        <BagButton onClick={() => openBag(null)} />
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
          <div className="flex flex-1 gap-4 pt-3.5 pb-3 sm:pb-6">
            <PcBox mons={mons} selected={selected} onPick={setPicked} />
            {wide && selectedMon && (
              <SummaryAside
                mon={selectedMon}
                sheet={sheet}
                footer={<AddButton slots={slots} mons={mons} mon={selectedMon} onChange={save} className="px-4.5 py-3.5" />}
              />
            )}
          </div>
        </>
      )}
      {!wide && (
        <SummarySheet
          mon={selectedMon}
          sheet={sheet}
          open={view === "pc" && selectedMon !== undefined}
          onClose={() => setPicked(null)}
          footer={
            selectedMon && (
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
            )
          }
        />
      )}
      <PasteDialog
        sheet={sheet}
        mons={mons}
        open={pasting}
        onOpenChange={setPasting}
        onImport={async (pasted) => {
          onTeam(await createTeam(team.tabId, pasted));
          setView("team");
        }}
      />
      <Bag
        sheet={sheet}
        open={bagOpen}
        onOpenChange={(open) => {
          setBagOpen(open);
          if (!open) setGiveTo(null);
        }}
        team={{
          slots,
          mons,
          giveTo,
          onGive: (slot, item) => given(giveItem(sheet, slots, slot, item)),
          onTeach: (slot, move) => given(teach(slots, slot, move)),
        }}
      />
    </div>
  );
}
