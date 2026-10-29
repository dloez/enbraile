import { Link } from "@tanstack/react-router";
import { type CSSProperties, useState } from "react";
import { Segmented } from "@/components/controls";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { Button } from "@/components/ui/button";
import { modeName } from "@/league/round-admin";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";
import { CUP_MAX, type CupKind, type CupSlotView, cupProblem, cupShape, cupSlots, firstRound, type GroupRow, type LeagueCup, type LeagueMode, type LeaguePage as League, leaguePage, MATCH_GAMES, played, winnerOf } from "../../shared/league";

const t = messages({
  en: {
    failed: "Something went wrong",
    first: "First round",
    triangular: "Losers' triangular",
    group: "Losers' group",
    final: "Final",
    semis: "Semifinals",
    semi: "Semifinal",
    quarters: "Quarterfinals",
    quarter: "Quarterfinal",
    roundOf: (n: number) => `Round of ${n}`,
    champion: "Champion",
    bracket: "Cup bracket",
    cup: "Cup",
    toBeDecided: "To be decided",
    bo3: `Bo${MATCH_GAMES}`,
    seeds: (a: number, b: number) => `${a} vs ${b} · Bo${MATCH_GAMES}`,
    trainer: "Trainer",
    w: "W",
    games: "Games",
    mons: "Mons",
    notStarted: "The cup has not started yet",
    whoEnters: "Who enters",
    enters: (name: string) => `${name} enters the cup`,
    pts: (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`,
    finished: "Finished the story",
    playing: "Still playing",
    out: "Stays out",
    count: (n: number, ready: boolean) => (ready ? `${n} enter · first round` : n > CUP_MAX ? `${n} enter · ${CUP_MAX} at most` : `${n} enter · no bracket yet`),
    firstRound: "The cup's first round",
    vs: "vs",
    start: "Start the cup",
    mode: "Mode",
    modeLabel: "The cup's mode",
    matchLabel: (a: string, b: string, score: string | null) => `${a} vs ${b}, ${score ?? "to play"}`,
  },
  es: {
    failed: "Algo ha fallado",
    first: "Primera ronda",
    triangular: "Triangular de perdedores",
    group: "Grupo de perdedores",
    final: "Final",
    semis: "Semifinales",
    semi: "Semifinal",
    quarters: "Cuartos de final",
    quarter: "Cuarto de final",
    roundOf: (n: number) => `Ronda de ${n}`,
    champion: "Campeón",
    bracket: "Cuadro de la copa",
    cup: "Copa",
    toBeDecided: "Por decidir",
    bo3: `Bo${MATCH_GAMES}`,
    seeds: (a: number, b: number) => `${a} contra ${b} · Bo${MATCH_GAMES}`,
    trainer: "Entrenador",
    w: "V",
    games: "Partidas",
    mons: "Pokémon",
    notStarted: "La copa aún no ha empezado",
    whoEnters: "Quién entra",
    enters: (name: string) => `${name} entra en la copa`,
    pts: (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`,
    finished: "Terminó la historia",
    playing: "Sigue jugando",
    out: "Se queda fuera",
    count: (n: number, ready: boolean) => (ready ? `Entran ${n} · primera ronda` : n > CUP_MAX ? `Entran ${n} · ${CUP_MAX} como máximo` : `Entran ${n} · aún sin cuadro`),
    firstRound: "Primera ronda de la copa",
    vs: "vs",
    start: "Empezar la copa",
    mode: "Modo",
    modeLabel: "Modo de la copa",
    matchLabel: (a: string, b: string, score: string | null) => `${a} contra ${b}, ${score ?? "por jugar"}`,
  },
});

export type Stage = { kind: CupKind; left: number | null; group: number };

export function stageName({ kind, left, group }: Stage, one = false): string {
  if (kind === "group") return group === 3 ? t.triangular : t.group;
  if (left === null) return t.first;
  if (left === 0) return t.final;
  if (left === 1) return one ? t.semi : t.semis;
  if (left === 2) return one ? t.quarter : t.quarters;
  return t.roundOf(2 ** (left + 1));
}

export function cupStage(league: { slot: string; entrants: number }): string {
  const slot = cupSlots(league.entrants).find((one) => one.key === league.slot);
  return slot ? stageName({ kind: slot.kind, left: slot.left, group: cupShape(league.entrants).half }, true) : t.cup;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

const MATCH = "/series/$number/league/matches/$id";

type Named = { league: League; nameOf: (id: string) => string };

export function CupView({ league, nameOf, onChange }: Named & { onChange: (league: League) => void }) {
  if (!league.cup) {
    return league.admin ? (
      <CupStart league={league} nameOf={nameOf} onChange={onChange} />
    ) : (
      <p className="m-0 rounded-[18px] border-3 border-dashed bg-box px-5 py-8 text-center font-heading text-2xl text-faint">{t.notStarted}</p>
    );
  }
  const cup = league.cup;
  const geometry = bracketGeometry(cup);
  return (
    <>
      <div className="hidden overflow-x-auto pb-2 lg:-mx-6 lg:block">
        <Bracket league={league} cup={cup} geometry={geometry} nameOf={nameOf} />
      </div>
      <div className="flex flex-col gap-5 lg:hidden">
        <Flow league={league} cup={cup} nameOf={nameOf} />
      </div>
    </>
  );
}

function openSlot(cup: LeagueCup): CupSlotView | undefined {
  return cup.slots.find((slot) => !(slot.a && slot.b && slot.gamesA !== null));
}

function stageKey(slot: CupSlotView): string {
  return slot.kind === "bracket" ? `b${slot.left}` : slot.kind;
}

export function cupStatus(cup: LeagueCup): string {
  const group = cupShape(cup.seeds.length).half;
  const open = openSlot(cup);
  if (cup.champion || !open) return t.champion;
  return stageName({ kind: open.kind, left: open.left, group });
}

export function cupNow(cup: LeagueCup): { stage: string; slots: CupSlotView[] } {
  const at = openSlot(cup) ?? cup.slots.at(-1)!;
  const key = stageKey(at);
  return {
    stage: stageName({ kind: at.kind, left: at.left, group: cupShape(cup.seeds.length).half }),
    slots: cup.slots.filter((slot) => stageKey(slot) === key),
  };
}

export function seedOf(cup: LeagueCup, player: string | null): number | null {
  if (!player) return null;
  const at = cup.seeds.indexOf(player);
  return at < 0 ? null : at + 1;
}

function tagOf(cup: LeagueCup, slot: CupSlotView): string {
  if (slot.kind === "first") {
    const a = seedOf(cup, slot.a);
    const b = seedOf(cup, slot.b);
    if (a !== null && b !== null) return t.seeds(a, b);
  }
  return t.bo3;
}

function resultOf(slot: CupSlotView) {
  return slot.a && slot.b ? { a: slot.a, b: slot.b, gamesA: slot.gamesA, gamesB: slot.gamesB, faintedA: slot.faintedA, faintedB: slot.faintedB } : null;
}

const matchRow = "outline-none hover:border-primary hover:bg-row-hi focus-visible:ring-3 focus-visible:ring-ring/50";

type Placed = { className?: string; style?: CSSProperties };

function MatchCard({ league, cup, slot, nameOf, className, style }: Named & Placed & { cup: LeagueCup; slot: CupSlotView }) {
  const result = resultOf(slot);
  const winner = result ? winnerOf(result) : null;
  const score = result && played(result) ? `${result.gamesA}–${result.gamesB}` : null;
  const sides = [
    { id: slot.a, games: slot.gamesA },
    { id: slot.b, games: slot.gamesB },
  ];
  const body = (
    <>
      <span className="flex min-h-7 items-center bg-box px-3 font-heading text-base text-muted-foreground sm:min-h-7.5 sm:text-[1.0625rem]">{tagOf(cup, slot)}</span>
      {sides.map((side, index) => {
        const name = side.id ? nameOf(side.id) : t.toBeDecided;
        const won = winner !== null && winner === side.id;
        return (
          <span
            key={index}
            className={cn("flex min-h-11.5 items-center gap-2.5 border-t-2 border-cell px-3 sm:min-h-12.5", winner !== null && !won && "opacity-50")}
          >
            <span className="w-4 font-heading text-[1.0625rem] text-faint sm:w-4.5 sm:text-lg">{seedOf(cup, side.id) ?? ""}</span>
            {side.id ? (
              <PlayerBadge name={name} colour={playerColour(name)} size="xs" />
            ) : (
              <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[7px] border-3 border-cell-hi bg-cell font-heading text-lg text-faint">
                ?
              </span>
            )}
            <span className={cn("min-w-0 flex-1 truncate font-heading text-[1.4375rem] sm:text-2xl", won ? "text-yellow" : side.id ? "text-foreground" : "text-faint")}>{name}</span>
            <span className={cn("font-heading text-[1.625rem] sm:text-[1.75rem]", won ? "text-yellow" : "text-foreground")}>{side.games ?? ""}</span>
          </span>
        );
      })}
    </>
  );
  const frame = cn("flex flex-col overflow-hidden rounded-[14px] border-3 bg-card text-foreground", className);
  if (!slot.match || !slot.a || !slot.b)
    return (
      <div className={frame} style={style}>
        {body}
      </div>
    );
  return (
    <Link
      to={MATCH}
      style={style}
      params={{ number: String(league.number), id: slot.match }}
      aria-label={t.matchLabel(nameOf(slot.a), nameOf(slot.b), score)}
      className={cn(frame, matchRow)}
    >
      {body}
    </Link>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

function GroupBox({ league, cup, nameOf, className, style, titled = false }: Named & Placed & { cup: LeagueCup; titled?: boolean }) {
  const group = cupShape(cup.seeds.length).half;
  const losers: GroupRow[] = cup.group;
  const matches = cup.slots.filter((slot) => slot.kind === "group" && slot.a && slot.b);
  return (
    <section aria-label={stageName({ kind: "group", left: null, group })} className={cn("flex flex-col overflow-hidden rounded-[14px] border-3 bg-card", className)} style={style}>
      {titled && (
        <div className="flex min-h-11 flex-col justify-center bg-box px-3.5 py-1">
          <h2 className="m-0 font-heading text-2xl font-normal">{stageName({ kind: "group", left: null, group })}</h2>
        </div>
      )}
      <div
        className={cn(
          "grid min-h-8 grid-cols-[minmax(0,1fr)_44px_60px_60px] items-center px-3 font-heading text-[1.0625rem] text-muted-foreground lg:grid-cols-[minmax(0,1fr)_44px_56px_56px]",
          titled ? "border-t-2 border-cell" : "bg-box",
        )}
      >
        <span>{t.trainer}</span>
        <span className="text-center">{t.w}</span>
        <span className="text-center">{t.games}</span>
        <span className="text-center">{t.mons}</span>
      </div>
      {losers.length === 0 && (
        <span className="border-t-2 border-cell px-3 py-2.5 font-heading text-xl text-faint">{t.toBeDecided}</span>
      )}
      {losers.map((row, index) => {
        const name = nameOf(row.player);
        const lead = row.through || (index === 0 && row.wins > 0 && !cup.group.some((r) => r.through));
        return (
          <div
            key={row.player}
            className={cn("grid min-h-11.5 grid-cols-[minmax(0,1fr)_44px_60px_60px] items-center border-t-2 border-cell px-3 lg:grid-cols-[minmax(0,1fr)_44px_56px_56px]", row.through && "bg-green/8")}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
              <span className={cn("truncate font-heading text-[1.4375rem]", lead ? "text-yellow" : "text-foreground")}>{name}</span>
            </span>
            <span className="text-center font-heading text-[1.4375rem]">{row.wins}</span>
            <span className="flex justify-center">
              <span
                className={cn(
                  "min-w-9 rounded-md border-2 px-1.5 text-center font-heading text-[1.3125rem] sm:text-[1.375rem]",
                  row.through ? "border-mult-2" : "border-transparent",
                  row.gameDiff > 0 ? "text-green" : row.gameDiff < 0 ? "text-coral" : "text-subtle",
                )}
              >
                {signed(row.gameDiff)}
              </span>
            </span>
            <span className="text-center font-heading text-[1.3125rem] text-subtle sm:text-[1.375rem]">{signed(row.monDiff)}</span>
          </div>
        );
      })}
      {matches.map((slot) => {
        const result = resultOf(slot)!;
        const winner = winnerOf(result);
        const score = played(result) ? `${result.gamesA}–${result.gamesB}` : null;
        return slot.match ? (
          <Link
            key={slot.key}
            to={MATCH}
            params={{ number: String(league.number), id: slot.match }}
            aria-label={t.matchLabel(nameOf(result.a), nameOf(result.b), score)}
            className="grid min-h-9 grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center border-t-2 border-cell px-3 font-heading text-[1.3125rem] text-foreground outline-none hover:bg-row-hi focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className={cn("truncate", winner === null ? "text-foreground" : winner === result.a ? "text-yellow" : "text-muted-foreground")}>{nameOf(result.a)}</span>
            <span className={cn("text-center", score ? "text-white" : "text-faint")}>{score ?? "–"}</span>
            <span className={cn("truncate text-right", winner === null ? "text-foreground" : winner === result.b ? "text-yellow" : "text-muted-foreground")}>
              {nameOf(result.b)}
            </span>
          </Link>
        ) : null;
      })}
    </section>
  );
}

function Trophy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M7 3h10v5a5 5 0 0 1-10 0z" className="fill-yellow" />
      <path d="M10 13h4v4h3v4H7v-4h3z" className="fill-yellow" />
      <path d="M4 4h3v3H5v1H4zM17 4h3v4h-1V7h-2z" className="fill-trophy-rim" />
    </svg>
  );
}

function ChampionBox({ cup, nameOf, className, style }: Placed & { cup: LeagueCup; nameOf: (id: string) => string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 rounded-[14px] border-3 border-trophy-rim bg-trophy p-3", className)} style={style}>
      <Trophy className="size-11 flex-none lg:size-14" />
      <span className="flex flex-col items-center leading-[1.05]">
        <span className="font-heading text-[1.75rem] text-yellow lg:text-[1.625rem]">{t.champion}</span>
        {cup.champion && <span className="font-heading text-2xl text-foreground">{nameOf(cup.champion)}</span>}
      </span>
    </div>
  );
}

function Flow({ league, cup, nameOf }: Named & { cup: LeagueCup }) {
  const group = cupShape(cup.seeds.length).half;
  const stages: { key: string; stage: Stage; slots: CupSlotView[] }[] = [];
  for (const slot of cup.slots) {
    const key = stageKey(slot);
    const held = stages.find((s) => s.key === key);
    if (held) held.slots.push(slot);
    else stages.push({ key, stage: { kind: slot.kind, left: slot.left, group }, slots: [slot] });
  }
  return (
    <>
      {stages.map(({ key, stage, slots }) => (
        <section key={key} aria-label={stageName(stage)} className="flex flex-col gap-2">
          <h2 className="m-0 px-1 font-heading text-[1.625rem] font-normal text-subtle">{stageName(stage)}</h2>
          {stage.kind === "group" ? (
            <GroupBox league={league} cup={cup} nameOf={nameOf} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {slots.map((slot) => (
                <MatchCard key={slot.key} league={league} cup={cup} slot={slot} nameOf={nameOf} />
              ))}
            </div>
          )}
          {stage.kind !== "group" && stage.left === 0 && <ChampionBox cup={cup} nameOf={nameOf} className="min-h-21" />}
        </section>
      ))}
    </>
  );
}

const BOX_W = 250;
const BOX_H = 140;
const TOP = 56;
const STEP = 180;
const HALF_GAP = 40;
const GROUP_X = 280;
const GROUP_W = 300;
const GROUP_HEAD = 44 + 32;
const GROUP_ROW = 46;
const GROUP_MATCH = 36;
const COLUMN = 290;
const FIRST_BEND = 30;
const BEND = 20;
const GROUP_LINE = 22;
const CHAMPION_W = 150;

type Box = { slot: CupSlotView; x: number; y: number };

type Geometry = {
  width: number;
  height: number;
  boxes: Box[];
  heads: { x: number; title: string }[];
  group: { x: number; y: number } | null;
  lines: string;
  open: string;
  champion: { x: number; y: number };
};

function leafKeys(entrants: number): (string | null)[] {
  const { rounds } = cupShape(entrants);
  if (rounds === 0) return ["f1"];
  return cupSlots(entrants)
    .filter((slot) => slot.kind === "bracket" && slot.left === rounds - 1)
    .flatMap((slot) => [slot.a, slot.b].map((feed) => ("winner" in feed ? feed.winner : null)));
}

function bracketGeometry(cup: LeagueCup): Geometry {
  const { half, plain, rounds } = cupShape(cup.seeds.length);
  const keys = leafKeys(cup.seeds.length);
  const fromGroup = keys.flatMap((key, at) => (key === null ? [at] : []));
  const leafY = (at: number) => TOP + at * STEP + (keys.length > 1 && at >= keys.length / 2 ? HALF_GAP : 0);
  const columnX = (depth: number) => (depth === 0 ? 0 : plain ? depth * (BOX_W + 70) : GROUP_X + GROUP_W + 60 + (depth - 1) * COLUMN);
  const byKey = new Map(cup.slots.map((slot) => [slot.key, slot]));
  const groupY = fromGroup.length ? leafY(fromGroup[0]!) - 76 : 0;
  const boxes: Box[] = [];
  const centre = new Map<string, number>();
  keys.forEach((key, at) => {
    if (key === null) return;
    boxes.push({ slot: byKey.get(key)!, x: 0, y: leafY(at) });
    centre.set(key, leafY(at) + BOX_H / 2);
  });
  const lines: string[] = [];
  const open: string[] = [];
  const decided = (key: string | undefined) => {
    if (!key) return cup.group.some((row) => row.through);
    const slot = byKey.get(key);
    return !!slot && slot.gamesA !== null && slot.gamesB !== null;
  };
  let last = { x: 0, y: TOP };
  for (let depth = 1; depth <= rounds; depth++) {
    const x = columnX(depth);
    const feeders = depth === 1 ? keys : cup.slots.filter((slot) => slot.kind === "bracket" && slot.left === rounds - depth + 1).map((slot) => slot.key);
    cup.slots
      .filter((slot) => slot.kind === "bracket" && slot.left === rounds - depth)
      .forEach((slot, index) => {
        const ends = [2 * index, 2 * index + 1].map((at) => {
          const key = feeders[at];
          return key ? { x: columnX(depth - 1) + BOX_W, y: centre.get(key)! } : { x: GROUP_X + GROUP_W, y: groupY + GROUP_LINE + fromGroup.indexOf(at) * STEP };
        });
        const mid = (ends[0]!.y + ends[1]!.y) / 2;
        const bend = x - (depth === 1 ? FIRST_BEND : BEND);
        ends.forEach((end, side) => (decided(feeders[2 * index + side] ?? undefined) ? lines : open).push(`M${end.x} ${end.y}H${bend}V${mid}H${x}`));
        centre.set(slot.key, mid);
        last = { x, y: mid - BOX_H / 2 };
        boxes.push({ slot, x, y: last.y });
      });
  }
  const champion = { x: last.x + BOX_W + 30, y: last.y };
  (cup.champion ? lines : open).push(`M${last.x + BOX_W} ${last.y + BOX_H / 2}H${champion.x}`);
  const heads = Array.from({ length: rounds + 1 }, (_, depth) => ({
    x: columnX(depth),
    title: depth === 0 ? stageName({ kind: "first", left: plain ? rounds : null, group: half }) : stageName({ kind: "bracket", left: rounds - depth, group: half }),
  }));
  const groupBottom = fromGroup.length ? groupY + GROUP_HEAD + half * GROUP_ROW + ((half * (half - 1)) / 2) * GROUP_MATCH + 12 : 0;
  return {
    width: champion.x + CHAMPION_W,
    height: Math.max(leafY(keys.length - 1) + BOX_H, groupBottom) + 8,
    boxes,
    heads,
    group: fromGroup.length ? { x: GROUP_X, y: groupY } : null,
    lines: lines.join(""),
    open: open.join(""),
    champion,
  };
}

function Bracket({ league, cup, geometry, nameOf }: Named & { cup: LeagueCup; geometry: Geometry }) {
  return (
    <div role="group" aria-label={t.bracket} className="relative" style={{ width: geometry.width, height: geometry.height }}>
      <svg width={geometry.width} height={geometry.height} aria-hidden="true" className="absolute inset-0">
        <path d={geometry.lines} fill="none" strokeWidth="3" className="stroke-faint" />
        <path d={geometry.open} fill="none" strokeWidth="3" strokeDasharray="8 6" className="stroke-cell-hi" />
      </svg>
      {geometry.heads.map((head) => (
        <h2 key={head.x} className="absolute top-0 m-0 px-1 font-heading text-[1.75rem] font-normal text-subtle" style={{ left: head.x }}>
          {head.title}
        </h2>
      ))}
      {geometry.boxes.map(({ slot, x, y }) => (
        <MatchCard key={slot.key} league={league} cup={cup} slot={slot} nameOf={nameOf} className="absolute h-35 w-62.5" style={{ left: x, top: y }} />
      ))}
      {geometry.group && <GroupBox league={league} cup={cup} nameOf={nameOf} titled className="absolute w-75" style={{ left: geometry.group.x, top: geometry.group.y }} />}
      <ChampionBox cup={cup} nameOf={nameOf} className="absolute h-35 w-37.5 flex-col" style={{ left: geometry.champion.x, top: geometry.champion.y }} />
    </div>
  );
}

function CupStart({ league, nameOf, onChange }: Named & { onChange: (league: League) => void }) {
  const [out, setOut] = useState<string[]>([]);
  const [mode, setMode] = useState<LeagueMode | "">(league.rounds.at(-1)?.mode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const order = league.standings.map((row) => row.player);
  const entrants = order.filter((player) => !out.includes(player));
  const n = entrants.length;
  const startable = cupProblem(order, entrants) === null;
  const pairs = n > CUP_MAX ? [] : firstRound(n).map(([a, b]) => [a - 1, b - 1] as const);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api(`/series/${league.number}/league/cup`, leaguePage, { method: "POST", body: { players: entrants, mode } }));
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  };

  const Seeded = ({ at, end = false }: { at: number; end?: boolean }) => {
    const name = nameOf(entrants[at]!);
    return (
      <span className={cn("flex min-w-0 items-center gap-2", end && "flex-row-reverse")}>
        <span className="w-4 flex-none font-heading text-lg text-faint">{at + 1}</span>
        <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
        <span className="truncate font-heading text-[1.4375rem]">{name}</span>
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-5">
      <section aria-labelledby="enter" className="flex flex-col gap-3 rounded-[18px] border-3 bg-card px-3.5 pt-3.5 pb-4 sm:px-5 sm:pt-4.5 sm:pb-5">
        <h2 id="enter" className="m-0 font-heading text-[1.875rem] font-normal">
          {t.whoEnters}
        </h2>
        <div className="overflow-hidden rounded-xl border-3 bg-box">
          {league.standings.map((row, index) => {
            const name = nameOf(row.player);
            const on = !out.includes(row.player);
            const seed = entrants.indexOf(row.player) + 1;
            const done = league.finished?.includes(row.player) ?? false;
            const status = on ? (done ? t.finished : t.playing) : t.out;
            const tone = on ? (done ? "text-green" : "text-muted-foreground") : "text-coral";
            return (
              <label
                key={row.player}
                className={cn(
                  "grid min-h-16 cursor-pointer grid-cols-[44px_36px_minmax(0,1fr)_auto] items-center pr-3 sm:min-h-18 sm:grid-cols-[56px_48px_minmax(0,1fr)_110px_220px] sm:pr-5",
                  !on && "bg-ink/50",
                  index < league.standings.length - 1 && "border-b-3",
                )}
              >
                <span className="grid place-items-center">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setOut(on ? [...out, row.player] : out.filter((player) => player !== row.player))}
                    aria-label={t.enters(name)}
                    className="size-6 cursor-pointer accent-green"
                  />
                </span>
                <span className={cn("text-center font-heading text-[1.875rem]", on && seed === 1 ? "text-yellow" : "text-faint")}>{on ? seed : "–"}</span>
                <span className={cn("flex min-w-0 items-center gap-3", !on && "opacity-45")}>
                  <PlayerBadge name={name} colour={playerColour(name)} size="sm" />
                  <span className="flex min-w-0 flex-col leading-[1.05]">
                    <span className="truncate font-heading text-[1.75rem]">{name}</span>
                    <span className={cn("font-heading text-lg sm:hidden", tone)}>{status}</span>
                  </span>
                </span>
                <span className={cn("text-center font-heading text-[1.625rem] text-subtle", !on && "opacity-45")}>{t.pts(row.points)}</span>
                <span className={cn("hidden font-heading text-xl sm:block", tone)}>{status}</span>
              </label>
            );
          })}
        </div>
      </section>
      <aside aria-label={t.firstRound} className="flex flex-col gap-3 rounded-[18px] border-3 bg-card px-3.5 pt-3.5 pb-4 sm:px-5 sm:pt-4.5 sm:pb-5">
        <h2 className="m-0 font-heading text-[1.875rem] font-normal">{t.count(n, startable)}</h2>
        {pairs.map(([a, b]) => (
          <div key={a} className="grid min-h-13 grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] items-center rounded-xl border-3 bg-box px-3.5">
            <Seeded at={a} />
            <span className="text-center font-heading text-[1.1875rem] text-faint">{t.vs}</span>
            <Seeded at={b} end />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2.5">
          <span id="cup-mode" className="sr-only">
            {t.modeLabel}
          </span>
          <span aria-hidden="true" className="font-heading text-xl text-muted-foreground">
            {t.mode}
          </span>
          <Segmented<LeagueMode | "">
            labelledBy="cup-mode"
            options={[
              { value: "open", label: modeName("open") },
              { value: "closed", label: modeName("closed") },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
        {error && (
          <p role="alert" className="m-0 text-sm font-bold text-destructive">
            {error}
          </p>
        )}
        <Button type="button" variant="go" disabled={busy || !startable || mode === ""} onClick={() => void start()} className="min-h-14 text-[1.625rem]">
          {t.start}
        </Button>
      </aside>
    </div>
  );
}
