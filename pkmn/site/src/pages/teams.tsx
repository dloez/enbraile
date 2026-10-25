import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { toolPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { describeMember } from "@/teams/dex";
import { teamList, teamMade, type TeamRow } from "../../shared/team";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

const DAY = 86_400_000;

export function changed(iso: string, now = Date.now()): string {
  const at = new Date(iso);
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return "Changed today";
  if (days === 1) return "Changed yesterday";
  if (days < 7) return `Changed ${days} days ago`;
  return `Changed in ${at.toLocaleString("en", { month: "long" })}`;
}

export function sourceLine(team: Pick<TeamRow, "owner" | "sources">): string {
  if (team.sources.length === 0) return "No source";
  const series = [...new Set(team.sources.map((s) => s.series.number))].map((n) => `Series ${n}`).join(", ");
  const from = team.sources.map((s) => (s.player.id === team.owner.id ? s.milestone : `${s.player.name}'s ${s.milestone}`));
  return `${series} · ${from.join(" · ")}`;
}

export function TeamsPage() {
  const { data } = authClient.useSession();
  const me = data?.user;
  const navigate = useNavigate();
  const [list, setList] = useState<TeamRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);

  useEffect(() => {
    let live = true;
    api("/teams", teamList).then(
      (next) => live && setList(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, []);

  async function newTeam() {
    setMaking(true);
    setError(null);
    try {
      const made = await api("/teams", teamMade, { body: {} });
      await navigate({ to: "/teams/$id", params: { id: made.id } });
    } catch (caught) {
      setError(message(caught));
      setMaking(false);
    }
  }

  const player = me && !me.admin ? me : null;
  const yours = player ? (list ?? []).filter((t) => t.owner.id === player.id) : [];
  const others = (list ?? []).filter((t) => t.owner.id !== player?.id);

  return (
    <main className={cn(toolPage, "gap-5 pt-5.5 pb-8 sm:gap-6 sm:pt-6")}>
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="m-0 font-heading text-5xl leading-[0.85] font-normal sm:text-6xl">Teams</h1>
        <div className="flex-1" />
        {player && (
          <button type="button" disabled={making} onClick={() => void newTeam()} className={buttonVariants({ variant: "go", className: "min-h-13 text-[1.625rem]" })}>
            <Plus className="size-5" aria-hidden="true" />
            New team
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {list && (
        <div className="flex flex-col gap-3.5">
          {player && <Group id="teams-yours" title="Yours" rows={yours} />}
          <Group id="teams-others" title={player ? "Other trainers" : "Every team"} rows={others} showOwner />
        </div>
      )}
    </main>
  );
}

function Group({ id, title, rows, showOwner = false }: { id: string; title: string; rows: TeamRow[]; showOwner?: boolean }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="m-0 px-1 font-heading text-[1.75rem] leading-none font-normal text-subtle">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="m-0 flex min-h-23 items-center rounded-[14px] border-3 border-dashed px-6 font-heading text-[1.75rem] text-muted-foreground">No teams yet</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((team) => (
            <li key={team.id}>
              <TeamLink team={team} showOwner={showOwner} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamLink({ team, showOwner }: { team: TeamRow; showOwner: boolean }) {
  const filled = team.members.filter((m) => m !== null).length;
  const size = team.members.length;
  return (
    <Link
      to="/teams/$id"
      params={{ id: team.id }}
      className="flex min-h-23 flex-wrap items-center gap-x-5 gap-y-2 rounded-[14px] border-3 bg-card py-3 pr-6 pl-4 text-foreground no-underline outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-nowrap sm:py-0"
    >
      <PlayerBadge name={team.owner.name} colour={playerColour(team.owner.id)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:w-75 sm:flex-none">
        <span className="truncate font-heading text-[2.125rem] leading-[0.9]">{team.name}</span>
        <span className="truncate text-sm font-bold text-muted-foreground">
          {showOwner && `${team.owner.name} · `}
          {sourceLine(team)}
        </span>
      </span>
      <span className="flex flex-none flex-col items-end gap-0.5 sm:order-last">
        <span className={cn("font-heading text-[1.375rem]", filled === size ? "text-green" : "text-warning")}>
          {filled}/{size}
        </span>
        <span className="text-[0.8125rem] whitespace-nowrap text-muted-foreground">{changed(team.updatedAt)}</span>
      </span>
      <span className="flex w-full min-w-0 gap-1 sm:w-auto sm:flex-1">
        {team.members.map((species, at) => {
          const sprite = species ? describeMember(species, species).sprite : null;
          return (
            <span
              key={at}
              className={cn(
                "flex h-12 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[10px] border-2 sm:h-18 sm:w-20 sm:flex-none",
                species ? "border-solid bg-box" : "border-dashed",
              )}
            >
              {sprite && <img src={sprite} alt="" className="-mt-1.5 -mb-0.5 size-14 flex-none [image-rendering:pixelated] sm:size-20" />}
            </span>
          );
        })}
      </span>
    </Link>
  );
}
