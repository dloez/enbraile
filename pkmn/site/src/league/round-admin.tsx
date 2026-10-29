import { useState } from "react";
import { Segmented } from "@/components/controls";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";
import {
  type LeagueMode,
  type LeaguePage as League,
  type LeagueRound,
  leaguePage,
  metIn,
  pairKey,
  type PairsInput,
  pairsProblem,
} from "../../shared/league";

const t = messages({
  en: {
    failed: "Something went wrong",
    admin: "Admin",
    round: (n: number) => `Round ${n}`,
    redraw: "Redraw",
    setPairs: "Set pairs",
    cancel: "Cancel",
    savePairs: "Save pairs",
    mode: "Mode",
    modeLabel: (n: number) => `Round ${n}'s mode`,
    open: "Open",
    closed: "Closed",
    openRound: (n: number) => `Open round ${n}`,
    allOpen: "Every round is open",
    settingPairs: "Setting pairs",
    notOpen: "Not open",
    toBeDrawn: "To be drawn",
    player: (match: number, side: number) => `Match ${match}, player ${side}`,
    rests: "Rests",
    restsLabel: "Who rests",
    same: "Same",
    twice: "Twice",
    met: (n: number) => `Met in R${n}`,
    missing: (names: string) => `Missing: ${names}`,
  },
  es: {
    failed: "Algo ha fallado",
    admin: "Admin",
    round: (n: number) => `Ronda ${n}`,
    redraw: "Volver a sortear",
    setPairs: "Poner parejas",
    cancel: "Cancelar",
    savePairs: "Guardar parejas",
    mode: "Modo",
    modeLabel: (n: number) => `Modo de la ronda ${n}`,
    open: "Abierta",
    closed: "Cerrada",
    openRound: (n: number) => `Abrir la ronda ${n}`,
    allOpen: "Todas las rondas están abiertas",
    settingPairs: "Poniendo parejas",
    notOpen: "Sin abrir",
    toBeDrawn: "Por sortear",
    player: (match: number, side: number) => `Combate ${match}, jugador ${side}`,
    rests: "Descansa",
    restsLabel: "Quién descansa",
    same: "El mismo",
    twice: "Dos veces",
    met: (n: number) => `Ya en R${n}`,
    missing: (names: string) => `Falta: ${names}`,
  },
});

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

function draftOf(round: LeagueRound): PairsInput {
  return { pairs: round.matches.map((m) => [m.a, m.b]), bye: round.bye };
}

function others(league: League, round: LeagueRound) {
  return metIn(league.rounds.filter((r) => r.number !== round.number));
}

export function RoundAdmin({
  league,
  draft,
  onDraft,
  onChange,
}: {
  league: League;
  draft: PairsInput | null;
  onDraft: (draft: PairsInput | null) => void;
  onChange: (league: League) => void;
}) {
  const newest = league.rounds.at(-1);
  const [mode, setMode] = useState<LeagueMode | "">(newest?.mode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/series/${league.number}/league/rounds`;

  const send = async (path: string, init: { method: string; body?: unknown }, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api(path, leaguePage, init));
      after?.();
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  };

  const pairable = newest && !newest.started;
  const bad = draft && newest ? pairsProblem(league.players.map((p) => p.id), draft.pairs, draft.bye, others(league, newest)) !== null : false;

  return (
    <section aria-label={t.admin} className="flex flex-col gap-2 rounded-[14px] border-3 border-dashed border-warning/60 bg-card px-3.5 py-3 sm:px-4.5">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
        <span className="font-heading text-[1.375rem] text-warning">{t.admin}</span>
        {pairable && (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-heading text-xl text-muted-foreground">{t.round(newest.number)}</span>
            {draft ? (
              <>
                <Button type="button" disabled={busy} onClick={() => onDraft(null)} className="text-[1.3125rem]">
                  {t.cancel}
                </Button>
                <Button
                  type="button"
                  variant="go"
                  disabled={busy || bad}
                  onClick={() => void send(`${base}/${newest.number}/pairs`, { method: "PUT", body: draft }, () => onDraft(null))}
                  className="text-[1.3125rem]"
                >
                  {t.savePairs}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" disabled={busy} onClick={() => void send(`${base}/${newest.number}/draw`, { method: "POST" })} className="text-[1.3125rem]">
                  {t.redraw}
                </Button>
                <Button type="button" disabled={busy} onClick={() => onDraft(draftOf(newest))} className="text-[1.3125rem]">
                  {t.setPairs}
                </Button>
              </>
            )}
          </div>
        )}
        {pairable && <span aria-hidden="true" className="hidden w-0.75 self-stretch bg-border sm:block" />}
        {league.next ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-heading text-xl text-muted-foreground">{t.round(league.next.number)}</span>
            <span id="round-mode" className="sr-only">
              {t.modeLabel(league.next.number)}
            </span>
            <span aria-hidden="true" className="font-heading text-xl text-muted-foreground">
              {t.mode}
            </span>
            <Segmented<LeagueMode | "">
              labelledBy="round-mode"
              options={[
                { value: "open", label: t.open },
                { value: "closed", label: t.closed },
              ]}
              value={mode}
              onChange={setMode}
            />
            <Button
              type="button"
              variant="go"
              disabled={busy || mode === "" || draft !== null}
              onClick={() => void send(base, { method: "POST", body: { mode } })}
              className="text-[1.3125rem]"
            >
              {t.openRound(league.next.number)}
            </Button>
          </div>
        ) : (
          <span className="font-heading text-xl text-green">{t.allOpen}</span>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm font-bold text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

export function PairsCard({
  league,
  round,
  draft,
  onDraft,
  nameOf,
}: {
  league: League;
  round: LeagueRound;
  draft: PairsInput;
  onDraft: (draft: PairsInput) => void;
  nameOf: (id: string) => string;
}) {
  const players = league.players.map((p) => p.id);
  const met = others(league, round);
  const placed = [...draft.pairs.flat(), ...(draft.bye === null ? [] : [draft.bye])];
  const twice = new Set(placed.filter((id, at) => placed.indexOf(id) !== at));
  const missing = players.filter((id) => !placed.includes(id));
  const warning = ([x, y]: readonly [string, string]) => {
    if (x === y) return t.same;
    if (twice.has(x) || twice.has(y)) return t.twice;
    const at = met.get(pairKey(x, y));
    return at === undefined ? null : t.met(at);
  };
  const pick = (value: string, onPick: (id: string) => void, label: string) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onPick(event.target.value)}
      className="min-h-8 min-w-0 flex-1 cursor-pointer rounded-lg border-2 border-cell-hi bg-ink px-1 font-heading text-xl text-foreground outline-none focus-visible:border-primary"
    >
      {players.map((id) => (
        <option key={id} value={id}>
          {nameOf(id)}
        </option>
      ))}
    </select>
  );
  return (
    <section aria-label={t.round(round.number)} className="flex flex-col gap-2 rounded-[18px] border-3 border-primary bg-card px-3 pt-3 pb-3.5 sm:gap-2.5 sm:px-3.5 sm:pt-3.5 sm:pb-4">
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="flex items-baseline gap-2.5">
          <h2 className="m-0 font-heading text-[1.75rem] font-normal sm:text-3xl">{t.round(round.number)}</h2>
          <span className="font-heading text-[1.1875rem] text-muted-foreground sm:text-xl">{round.milestone}</span>
        </span>
        <span className="font-heading text-[1.1875rem] text-primary sm:text-xl">{t.settingPairs}</span>
      </div>
      {draft.pairs.map((pair, at) => {
        const warn = warning(pair);
        return (
          <div key={at} className={cn("flex flex-col overflow-hidden rounded-xl border-3 bg-box", warn ? "border-warning" : "border-border")}>
            {pair.map((id, side) => {
              const name = nameOf(id);
              return (
                <span key={side} className={cn("flex min-h-10 items-center gap-2.5 px-2.5", side === 1 && "border-t-2 border-cell")}>
                  <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
                  {pick(
                    id,
                    (value) => onDraft({ ...draft, pairs: draft.pairs.map((p, i) => (i === at ? (side === 0 ? [value, p[1]] : [p[0], value]) : p)) }),
                    t.player(at + 1, side + 1),
                  )}
                  {side === 1 && warn && <span className="font-heading text-[1.0625rem] text-warning">{warn}</span>}
                </span>
              );
            })}
          </div>
        );
      })}
      {draft.bye !== null && (
        <span className="flex min-h-10 items-center gap-2.5 px-0.5">
          <span className="font-heading text-lg text-muted-foreground">{t.rests}</span>
          {pick(draft.bye, (value) => onDraft({ ...draft, bye: value }), t.restsLabel)}
        </span>
      )}
      {missing.length > 0 && <span className="px-0.5 font-heading text-lg text-warning">{t.missing(missing.map(nameOf).join(", "))}</span>}
    </section>
  );
}

export function UnopenedCard({ number, milestone, matches }: { number: number; milestone: string; matches: number }) {
  return (
    <section aria-label={t.round(number)} className="hidden flex-col gap-2.5 rounded-[18px] border-3 border-dashed px-3.5 pt-3.5 pb-4 sm:flex">
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="flex items-baseline gap-2.5">
          <h2 className="m-0 font-heading text-3xl font-normal text-muted-foreground">{t.round(number)}</h2>
          <span className="font-heading text-xl text-muted-foreground">{milestone}</span>
        </span>
        <span className="font-heading text-xl text-faint">{t.notOpen}</span>
      </div>
      {Array.from({ length: matches }, (_, at) => (
        <div key={at} aria-hidden="true" className="flex flex-col rounded-xl border-3 border-dashed">
          {[0, 1].map((side) => (
            <span key={side} className={cn("flex min-h-10 items-center gap-2.5 px-3", side === 1 && "border-t-2 border-dashed border-cell")}>
              <span className="size-6.5 flex-none rounded-md bg-cell" />
              <span className="font-heading text-[1.4375rem] text-faint">{t.toBeDrawn}</span>
            </span>
          ))}
        </div>
      ))}
    </section>
  );
}

export function modeName(mode: LeagueMode): string {
  return mode === "open" ? t.open : t.closed;
}
