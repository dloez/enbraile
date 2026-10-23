import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { buttonClass, Panel } from "@/components/controls";
import { listPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminGate } from "@/pages/admin";
import { player, playerList, type Player } from "../../shared/players";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export function AdminPlayersPage() {
  return (
    <AdminGate>
      <AdminPlayers />
    </AdminGate>
  );
}

function AdminPlayers() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlayers(await api("/players", playerList));
    } catch (caught) {
      setError(message(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setAllowed(target: Player, allowed: boolean) {
    setBusy(target.id);
    setError(null);
    try {
      const updated = await api(`/players/${target.id}/allowed`, player, { body: { allowed } });
      setPlayers((current) => current?.map((p) => (p.id === updated.id ? updated : p)) ?? null);
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(null);
  }

  const waiting = players?.filter((p) => !p.allowed) ?? [];
  const allowed = players?.filter((p) => p.allowed) ?? [];

  return (
    <main className={cn(listPage, "gap-7 py-7 sm:py-9")}>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 flex-1 font-heading text-5xl leading-none sm:text-6xl">Players</h1>
        <Link to="/admin" className={buttonClass}>
          Admin
        </Link>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      {players && (
        <>
          <PlayerList title="Waiting" players={waiting} action="Allow" busy={busy} onAct={(p) => setAllowed(p, true)} />
          <PlayerList title="Allowed" players={allowed} action="Remove" busy={busy} onAct={(p) => setAllowed(p, false)} />
        </>
      )}
    </main>
  );
}

function PlayerList({
  title,
  players,
  action,
  busy,
  onAct,
}: {
  title: string;
  players: Player[];
  action: "Allow" | "Remove";
  busy: string | null;
  onAct: (target: Player) => void;
}) {
  return (
    <Panel title={title} aside={<span className="text-sm text-muted-foreground tabular-nums">{players.length}</span>}>
      {players.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Nobody</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border bg-muted px-3 py-2">
              <Link
                to="/players/$player"
                params={{ player: p.id }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <PlayerBadge name={p.name} colour={playerColour(p.id)} />
                <span className="truncate font-heading text-2xl">{p.name}</span>
              </Link>
              <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">{formatDate(p.joinedAt)}</span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => onAct(p)}
                className={buttonVariants({ variant: action === "Remove" ? "destructive" : "default" })}
              >
                {action}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
