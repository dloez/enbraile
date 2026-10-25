import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { displayName, type Mon } from "@/teams/dex";
import { describeMember } from "../../../shared/species";
import { addMember, isFree, newMember } from "@/teams/team";
import { emptySlots, teamDone, teamList, teamMade, teamPage, type TeamRow } from "../../../shared/team";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function useOwnTeams(owner: string | null, snapshot: string | null): TeamRow[] {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  useEffect(() => {
    if (owner === null || snapshot === null) return;
    let live = true;
    api(`/teams?owner=${encodeURIComponent(owner)}`, teamList).then(
      (list) => live && setTeams(list.filter((t) => t.sources.some((s) => s.id === snapshot))),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [owner, snapshot]);
  return teams;
}

export function AddToTeam({ mon, snapshot, teams, className }: { mon: Mon; snapshot: string; teams: readonly TeamRow[]; className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      const id = await work();
      await navigate({ to: "/teams/$id", params: { id } });
    } catch (caught) {
      setError(message(caught));
      setBusy(false);
    }
  }

  const intoNew = () =>
    run(async () => {
      const slots = emptySlots();
      slots[0] = newMember(mon, snapshot);
      return (await api("/teams", teamMade, { body: { sources: [snapshot], slots } })).id;
    });

  const into = (id: string) =>
    run(async () => {
      const team = await api(`/teams/${encodeURIComponent(id)}`, teamPage);
      if (team.slots.some((m) => m !== null && !isFree(m) && m.source === snapshot && m.index === mon.index)) return id;
      const slots = addMember(team.slots, mon, snapshot);
      if (!slots) throw new Error(`${team.name} is full`);
      await api(`/teams/${encodeURIComponent(id)}`, teamDone, { method: "PUT", body: { slots } });
      return id;
    });

  return (
    <div className={cn("relative flex-none border-t-3", className)}>
      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-10" />
          <div role="menu" aria-label="Add to team" className="absolute right-4 bottom-full left-4 z-20 mb-2 flex flex-col gap-0.5 rounded-[14px] border-3 border-cell-hi bg-ink p-2 shadow-[0_8px_0_var(--edge)]">
            <p className="m-0 px-2.5 pt-1 pb-1.5 font-heading text-[1.3125rem] text-muted-foreground">Add {displayName(mon)} to…</p>
            {teams.map((team) => {
              const filled = team.members.filter((m) => m !== null).length;
              const full = filled >= team.members.length;
              const off = full || busy;
              return (
                <button
                  key={team.id}
                  type="button"
                  role="menuitem"
                  disabled={off}
                  onClick={() => void into(team.id)}
                  className="flex min-h-13 cursor-pointer items-center gap-2.5 rounded-[9px] border-none bg-transparent px-2.5 text-left text-white outline-none enabled:hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:text-faint"
                >
                  <span className="flex h-6 w-19 flex-none overflow-hidden">
                    {team.members.flatMap((species, at) => {
                      const sprite = species ? describeMember(species, species).sprite : null;
                      return sprite ? [<img key={at} src={sprite} alt="" className="-mt-1 mr-[-9px] size-8 flex-none [image-rendering:pixelated]" />] : [];
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-heading text-2xl leading-none">{team.name}</span>
                  <span className="flex-none font-heading text-[1.1875rem] text-muted-foreground">{full ? "Full" : `${filled}/${team.members.length}`}</span>
                </button>
              );
            })}
            {teams.length > 0 && <span aria-hidden="true" className="mx-2 my-1 h-0.75 rounded-full bg-cell" />}
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void intoNew()}
              className="flex min-h-13 cursor-pointer items-center gap-2.5 rounded-[9px] border-none bg-transparent px-2.5 text-left font-heading text-2xl text-primary outline-none enabled:hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              New team
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="m-0 pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={buttonVariants({ variant: "go", className: "min-h-13 w-full rounded-[10px] text-[1.625rem]" })}
      >
        Add to team
      </button>
    </div>
  );
}
