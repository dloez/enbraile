import { Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { formFieldClass, formLabelClass } from "@/components/controls";
import { adminPage, AdminPlayersFrame } from "@/components/page-frames";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { joinedOn } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import { player, playerList, removed, type Player } from "../../shared/players";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/players", playerList).then(setPlayers, (caught: unknown) => setError(message(caught)));
  }, []);

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

  if (!players && !error) return <AdminPlayersFrame />;
  const waiting = players?.filter((p) => !p.allowed) ?? [];
  const allowed = players?.filter((p) => p.allowed) ?? [];

  return (
    <main className={adminPage}>
      <h1 className="sr-only">Admin players</h1>
      <AdminNav waiting={waiting.length} />
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {players && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_23.75rem] lg:gap-6">
          <div className="flex flex-col gap-4 sm:gap-5">
            <PlayerList id="players-waiting" title="Waiting" note="Signed in, not let in yet" players={waiting} busy={busy} onAct={(p) => setAllowed(p, true)} onDelete={remove} />
            <PlayerList id="players-allowed" title="Allowed" note="Removing one keeps their saves; they wait again" players={allowed} busy={busy} onAct={(p) => setAllowed(p, false)} onDelete={remove} />
          </div>
          <InviteForm onInvited={(invited) => setPlayers((current) => [...(current ?? []), invited])} />
        </div>
      )}
    </main>
  );
}

function PlayerList({
  id,
  title,
  note,
  players,
  busy,
  onAct,
  onDelete,
}: {
  id: string;
  title: "Waiting" | "Allowed";
  note: string;
  players: Player[];
  busy: string | null;
  onAct: (target: Player) => void;
  onDelete: (target: Player) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const waiting = title === "Waiting";
  const lit = waiting && players.length > 0;
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2.5 rounded-2xl border-3 bg-card p-4 sm:px-5.5 sm:py-5", lit && "border-yellow/55")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="m-0 font-heading text-3xl leading-none font-normal sm:text-[2.125rem]">
          {title}
        </h2>
        <span className={cn("font-heading text-[1.375rem] sm:text-2xl", lit ? "text-yellow" : "text-muted-foreground")}>{players.length}</span>
        <span className="ml-auto text-[0.8125rem] text-muted-foreground max-sm:hidden">{note}</span>
      </div>
      {players.length === 0 ? (
        <div className="flex min-h-15 items-center justify-center rounded-xl border-3 border-dashed font-heading text-2xl text-muted-foreground sm:min-h-18 sm:text-[1.625rem]">Nobody</div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {players.map((p) => {
            const asking = confirming === p.id;
            return (
              <li key={p.id} className="flex flex-col gap-2.5 rounded-xl border-2 border-cell bg-box p-3 sm:min-h-16.5 sm:flex-row sm:items-center sm:gap-3.5 sm:py-0 sm:pr-3 sm:pl-3.5">
                <Link
                  to="/players/$player"
                  params={{ player: p.id }}
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-3.5"
                >
                  <PlayerBadge name={p.name} colour={playerColour(p.name)} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="truncate font-heading text-[1.5625rem] leading-none decoration-2 underline-offset-4 group-hover:underline sm:text-[1.75rem]">{p.name}</span>
                      {p.invited && <span className="flex-none rounded-md bg-primary/15 px-2 font-heading text-base text-primary sm:text-lg">Invited</span>}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground sm:text-[0.8125rem]">
                      {p.invited ? "Not signed in yet" : waiting ? `Signed in ${joinedOn(p.joinedAt)}` : `Joined ${joinedOn(p.joinedAt)}`}
                    </span>
                  </span>
                </Link>
                {asking && <span className="text-xs font-bold text-stat-up sm:text-[0.8125rem]">Deletes their saves and snapshots{" "}<span className="sm:hidden">· press again</span></span>}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2.5">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      if (asking || p.invited) {
                        setConfirming(null);
                        onDelete(p);
                      } else setConfirming(p.id);
                    }}
                    className={cn(
                      "min-h-11 cursor-pointer rounded-lg border-2 px-3.5 font-heading text-[1.3125rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50",
                      asking ? "border-destructive bg-destructive text-ink" : "border-destructive/45 bg-transparent text-destructive hover:bg-destructive/15",
                    )}
                  >
                    {asking ? "Confirm delete" : "Delete"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirming(null);
                      onAct(p);
                    }}
                    className={buttonVariants({ variant: waiting ? "go" : "default", className: "min-w-26 px-4 text-[1.4375rem]" })}
                  >
                    {waiting ? "Let in" : "Remove"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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

  return (
    <form onSubmit={submit} aria-labelledby="invite-title" className="flex flex-col gap-3.5 rounded-2xl border-3 bg-card p-4 sm:px-5.5 sm:py-5">
      <h2 id="invite-title" className="m-0 font-heading text-3xl leading-none font-normal sm:text-[2.125rem]">
        Invite
      </h2>
      <p className="m-0 text-[0.8125rem] text-subtle sm:text-sm">Let a friend in before they sign in. Their first Discord sign-in lands them straight in, already allowed.</p>
      <label className={formLabelClass}>
        Discord user ID
        <input
          name="discordId"
          required
          inputMode="numeric"
          pattern="\d{17,20}"
          placeholder="17 to 20 digits"
          value={discordId}
          onChange={(event) => setDiscordId(event.target.value)}
          className={cn(formFieldClass, "tabular-nums")}
        />
      </label>
      <label className={formLabelClass}>
        Name
        <input name="name" required maxLength={32} placeholder="Until Discord gives theirs" value={name} onChange={(event) => setName(event.target.value)} className={formFieldClass} />
      </label>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonVariants({ variant: "go", className: "mt-0.5 min-h-12.5 text-[1.625rem]" })}>
        Invite
      </button>
    </form>
  );
}
