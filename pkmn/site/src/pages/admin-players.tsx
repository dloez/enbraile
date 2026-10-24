import { Link } from "@tanstack/react-router";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { buttonClass, fieldClass, Panel } from "@/components/controls";
import { listPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminGate } from "@/pages/admin";
import { player, playerList, removed, type Player } from "../../shared/players";

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

  async function remove(target: Player) {
    setBusy(target.id);
    setError(null);
    try {
      const gone = await api(`/players/${target.id}`, removed, { method: "DELETE" });
      setPlayers((current) => current?.filter((p) => p.id !== gone.id) ?? null);
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
          <InviteForm onInvited={(invited) => setPlayers((current) => [...(current ?? []), invited])} />
          <PlayerList title="Waiting" players={waiting} action="Allow" busy={busy} onAct={(p) => setAllowed(p, true)} onDelete={remove} />
          <PlayerList title="Allowed" players={allowed} action="Remove" busy={busy} onAct={(p) => setAllowed(p, false)} onDelete={remove} />
        </>
      )}
    </main>
  );
}

function InviteForm({ onInvited }: { onInvited: (invited: Player) => void }) {
  const [discordId, setDiscordId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onInvited(await api("/players", player, { body: { discordId, name } }));
      setDiscordId("");
      setName("");
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  }

  const field = cn(fieldClass, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50");

  return (
    <Panel title="Invite">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
            Discord user ID
            <input
              name="discordId"
              required
              inputMode="numeric"
              pattern="\d{17,20}"
              value={discordId}
              onChange={(event) => setDiscordId(event.target.value)}
              className={cn(field, "tabular-nums")}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
            Name
            <input name="name" required maxLength={32} value={name} onChange={(event) => setName(event.target.value)} className={field} />
          </label>
        </div>
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={cn(buttonClass, "self-start")}>
          Invite
        </button>
      </form>
    </Panel>
  );
}

function PlayerList({
  title,
  players,
  action,
  busy,
  onAct,
  onDelete,
}: {
  title: string;
  players: Player[];
  action: "Allow" | "Remove";
  busy: string | null;
  onAct: (target: Player) => void;
  onDelete: (target: Player) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
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
              {p.invited ? (
                <span className="text-sm text-muted-foreground">Invited</span>
              ) : (
                <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">{formatDate(p.joinedAt)}</span>
              )}
              {confirming === p.id ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setConfirming(null);
                    onDelete(p);
                  }}
                  className={buttonVariants({ variant: "destructive" })}
                >
                  Confirm delete
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => (p.invited ? onDelete(p) : setConfirming(p.id))}
                  className={buttonVariants({ variant: "destructive" })}
                >
                  Delete
                </button>
              )}
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
