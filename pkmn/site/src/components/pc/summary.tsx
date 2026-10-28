import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayName, fightStat, learnCount, STAT_LABELS, type BagTm, type Mon, type MoveInfo, type StatID } from "../../../shared/mon";
import { UnknownMark } from "@/components/marks";
import { MonSprite } from "@/components/pc/mon-sprite";
import type { ExportGap } from "../../../shared/snapshot";
import { categoryLabel, typeLabel } from "../../../shared/dex-text";
import { messages } from "../../../shared/i18n";

type Lack = "ivs" | "evs" | "stats";

const t = messages({
  en: {
    nature: "Nature",
    raises: "Raises ",
    lowers: "Lowers ",
    mismatch: (save: string, showdown: string) => `Save: ${save} · Showdown: ${showdown}`,
    ability: "Ability",
    abilities: "Abilities",
    hidden: "Hidden",
    inUse: "In use",
    whoShares: (name: string) => `Who shares ${name}`,
    defenses: "Type defenses",
    base: "Base",
    lv: (level: number | string) => `Lv ${level}`,
    lacking: (lacks: Lack[], range: boolean) => {
      const names = lacks.map((l) => (l === "ivs" ? "IVs" : l === "evs" ? "EVs" : "stats"));
      return `No ${names.join(", ").replace(/, ([^,]*)$/, " or $1")} in this export${range ? ": Lv 50 shows the range over IVs 0–31" : ""}`;
    },
    statsShown: "Stats shown",
    stat: "Stat",
    total: "Total",
    freeFifty: "At Level 50 with its IVs, EVs and nature.",
    leagueFifty: "As in the league's Showdown fights: its IVs and nature, 1 EV in every stat.",
    noMoves: "No moves in this export",
    moves: "Moves",
    canLearn: "Can learn",
    pow: "Pow",
    noLevels: "No move levels in this snapshot: upload its save again to see them",
    noTmRolls: "No TM rolls in this export: TMs the game has not rolled for it yet are missing",
    selectedMove: "Selected move",
    power: "Power",
    accuracy: "Accuracy",
    level: (level: number | string) => `Lv. ${level}`,
    male: " male",
    female: " female",
    fainted: "Fainted",
    shiny: "Shiny",
    info: "Info",
    stats: "Stats",
    summary: "Summary",
  },
  es: {
    nature: "Naturaleza",
    raises: "Sube ",
    lowers: "Baja ",
    mismatch: (save: string, showdown: string) => `Partida: ${save} · Showdown: ${showdown}`,
    ability: "Habilidad",
    abilities: "Habilidades",
    hidden: "Oculta",
    inUse: "En uso",
    whoShares: (name: string) => `Quién más tiene ${name}`,
    defenses: "Defensas por tipo",
    base: "Base",
    lv: (level: number | string) => `Nv ${level}`,
    lacking: (lacks: Lack[], range: boolean) => {
      const names = lacks.map((l) => (l === "ivs" ? "IVs" : l === "evs" ? "EVs" : "estadísticas"));
      return `No hay ${names.join(", ").replace(/, ([^,]*)$/, " ni $1")} en esta exportación${range ? ": Nv 50 muestra el rango con IVs de 0 a 31" : ""}`;
    },
    statsShown: "Estadísticas mostradas",
    stat: "Est.",
    total: "Total",
    freeFifty: "A nivel 50 con sus IVs, EVs y naturaleza.",
    leagueFifty: "Como en los combates de Showdown de la liga: sus IVs y naturaleza, 1 EV en cada estadística.",
    noMoves: "No hay movimientos en esta exportación",
    moves: "Movimientos",
    canLearn: "Puede aprender",
    pow: "Pot",
    noLevels: "No hay niveles de movimientos en esta captura: vuelve a subir su partida para verlos",
    noTmRolls: "No hay tiradas de MT en esta exportación: faltan las MT que el juego aún no le ha tirado",
    selectedMove: "Movimiento elegido",
    power: "Potencia",
    accuracy: "Precisión",
    level: (level: number | string) => `Nv. ${level}`,
    male: " macho",
    female: " hembra",
    fainted: "Debilitado",
    shiny: "Variocolor",
    info: "Info",
    stats: "Estadísticas",
    summary: "Resumen",
  },
});

type Page = "info" | "stats" | "moves";

type StatMode = "level" | "fifty" | "base";

const DEFENSE_ORDER = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
] as const;

const MULTIPLIERS: Record<number, [string, string]> = {
  4: ["×4", "bg-mult-4 text-white"],
  2: ["×2", "bg-mult-2 text-white"],
  1: ["", "bg-box"],
  0.5: ["½", "bg-mult-half text-white"],
  0.25: ["¼", "bg-mult-quarter text-white"],
  0: ["0", "bg-mult-0 text-foreground"],
};

const segClass = (on: boolean) =>
  cn(
    "min-h-10 min-w-0 flex-1 cursor-pointer rounded-lg border-none font-heading text-[1.4375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    on ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
  );

const trackClass = "flex gap-1 rounded-xl border-3 bg-ink p-1";

function typeStyle(type: string | null) {
  return { background: type ? `var(--type-${type.toLowerCase()}, var(--faint))` : "var(--faint)" };
}

export function TypeTag({ type, className }: { type: string | null; className?: string }) {
  return (
    <span
      className={cn("rounded-[5px] px-2.5 text-center font-heading text-xl text-white [text-shadow:0_1px_0_rgb(0_0_0/0.45)]", className)}
      style={typeStyle(type)}
    >
      {type ? typeLabel(type) : "?"}
    </span>
  );
}

export function CategoryTag({ category, className }: { category: string | null; className?: string }) {
  if (!category) return null;
  return (
    <span
      className={cn(
        "rounded-[5px] px-1.75 font-heading text-[1.0625rem] leading-5.5 text-ink",
        category === "Physical" ? "bg-cat-physical" : category === "Special" ? "bg-cat-special" : "bg-subtle",
        className,
      )}
    >
      {categoryLabel(category)}
    </span>
  );
}

export function GapWarning({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex flex-none items-center gap-2.5 rounded-xl border border-warning bg-warning-soft px-3.5 py-2.5">
      <TriangleAlert aria-hidden="true" className="size-4.5 flex-none text-warning" />
      <span className="text-sm font-bold text-warning-ink">{children}</span>
    </p>
  );
}

export function tint(ratio: number): string {
  return ratio < 1 / 3 ? "bg-coral" : ratio < 0.5 ? "bg-yellow" : ratio < 2 / 3 ? "bg-green" : "bg-cyan";
}

function Info({ mon, series }: { mon: Mon; series?: number }) {
  const n = mon.nature;
  const current = mon.abilities.find((a) => a.current) ?? mon.abilities[0];
  const [picked, setPicked] = useState(current?.id ?? null);
  const shown = mon.abilities.find((a) => a.id === picked) ?? current;
  const defenses = DEFENSE_ORDER.map((attack) => {
    const m = mon.defenses[attack];
    const [label, cls] = MULTIPLIERS[m] ?? [`×${m}`, "bg-box"];
    return { attack, m, label, cls };
  });
  return (
    <>
      <section aria-labelledby="sum-nature" className="flex items-center gap-3 rounded-xl border-3 border-cell bg-box px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id="sum-nature" className="m-0 font-heading text-xl leading-none font-normal text-muted-foreground">
            {t.nature}
          </h3>
          <span className="font-heading text-[1.625rem] leading-none">
            {n?.name ?? "—"}
            {n?.marked && <UnknownMark />}
          </span>
        </div>
        {n?.plus && n.minus && n.plus !== n.minus && (
          <>
            <span className="flex h-8 items-center gap-1 rounded-[7px] bg-stat-up/14 px-2.5 font-heading text-[1.3125rem] text-stat-up">
              <svg viewBox="0 0 5 4" shapeRendering="crispEdges" aria-hidden="true" className="h-2 w-2.5 fill-current">
                <path d="M2 0h1v1H2zM1 1h3v1H1zM0 2h5v2H0z" />
              </svg>
              <span className="sr-only">{t.raises}</span>
              {STAT_LABELS[n.plus]}
            </span>
            <span className="flex h-8 items-center gap-1 rounded-[7px] bg-stat-down/14 px-2.5 font-heading text-[1.3125rem] text-stat-down">
              <svg viewBox="0 0 5 4" shapeRendering="crispEdges" aria-hidden="true" className="h-2 w-2.5 fill-current">
                <path d="M0 0h5v2H0zM1 2h3v1H1zM2 3h1v1H2z" />
              </svg>
              <span className="sr-only">{t.lowers}</span>
              {STAT_LABELS[n.minus]}
            </span>
          </>
        )}
      </section>

      {mon.mismatch && mon.showdownTypes && (
        <p className="m-0 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm">
          {t.mismatch(mon.types.map(typeLabel).join(" / "), mon.showdownTypes.map(typeLabel).join(" / "))}
        </p>
      )}

      {mon.abilities.length > 0 && (
        <section aria-labelledby="sum-ability" className="flex flex-col rounded-xl border-3 border-cell bg-box px-2 pt-2.5">
          <h3 id="sum-ability" className="m-0 px-1.5 pb-2 font-heading text-xl leading-none font-normal text-muted-foreground">
            {t.ability}
          </h3>
          <div role="tablist" aria-label={t.abilities} aria-orientation="vertical" className="flex flex-col gap-0.5">
            {mon.abilities.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={a.id === shown?.id}
                onClick={() => setPicked(a.id)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-none px-3 text-left text-[0.9375rem] font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  a.id === shown?.id ? "bg-cell text-white" : "bg-transparent text-subtle hover:bg-cell hover:text-white",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {a.name}
                  {a.marked && <UnknownMark />}
                </span>
                {a.hidden && (
                  <span className="flex-none rounded-md border-2 border-cell-hi px-1.5 font-heading text-base leading-5 font-normal text-subtle">{t.hidden}</span>
                )}
                {a.current && <span className="flex-none rounded-md bg-cyan px-2 py-0.5 font-heading text-base leading-5 font-normal text-ink">{t.inUse}</span>}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="-mx-2 mt-2 flex min-h-20 flex-col gap-1 border-t-3 border-cell px-4 pt-3 pb-2">
            <p className="m-0 text-sm leading-relaxed text-subtle">{shown?.desc || "—"}</p>
            {series !== undefined && shown && (
              <Link
                to="/series/$number/abilities"
                params={{ number: String(series) }}
                search={{ ability: shown.id }}
                className="-mx-1 flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 font-heading text-xl text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t.whoShares(shown.name)}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="sum-def" className="flex flex-col gap-2">
        <h3 id="sum-def" className="m-0 font-heading text-xl leading-none font-normal text-muted-foreground">
          {t.defenses}
        </h3>
        {[defenses.slice(0, 9), defenses.slice(9)].map((row, i) => (
          <div key={i} className="grid grid-cols-9 gap-1">
            {row.map((d) => (
              <span key={d.attack} title={`${typeLabel(d.attack)} ×${d.m}`} className="flex min-w-0 flex-col gap-0.75">
                <span
                  className="block rounded-[5px] text-center font-heading text-lg leading-6 text-white [text-shadow:0_1px_0_rgb(0_0_0/0.5)]"
                  style={typeStyle(d.attack)}
                >
                  {typeLabel(d.attack).slice(0, 3).toUpperCase()}
                </span>
                <span className={cn("grid h-9 place-items-center rounded-[5px] font-heading text-[1.5625rem]", d.cls)}>
                  {d.label}
                  <span className="sr-only">{d.label ? "" : "×1"}</span>
                </span>
              </span>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}

function Stats({ mon }: { mon: Mon }) {
  const n = mon.nature;
  const known = mon.stats?.some((s) => s.current !== null) ?? false;
  const [mode, setMode] = useState<StatMode>("base");
  const stats = mon.stats ?? [];
  const modes: [StatMode, string][] = [
    ["base", t.base],
    ["level", t.lv(mon.level ?? "?")],
    ["fifty", t.lv(50)],
  ];
  const mark = (stat: StatID) => {
    const up = n?.plus === stat && n.minus !== stat;
    const down = n?.minus === stat && n.plus !== stat;
    return { ink: up ? "text-stat-up" : down ? "text-stat-down" : "text-muted-foreground", sign: up ? "+" : down ? "−" : "" };
  };
  const top = (stat: StatID, level: number) => {
    const core = Math.floor((454 * level) / 100);
    return stat === "hp" ? core + level + 10 : core + 5;
  };
  const value = (s: (typeof stats)[number]) =>
    mode === "level" ? (s.current === null ? "—" : String(s.current)) : mode === "fifty" ? fightStat(s) : String(s.base);
  const ratio = (s: (typeof stats)[number]) =>
    mode === "base"
      ? s.base / 180
      : mode === "level"
        ? (s.current ?? 0) / top(s.stat, mon.level ?? 100)
        : (s.fight ?? s.high) / top(s.stat, 50);
  const total =
    mode === "base"
      ? String(stats.reduce((t, s) => t + s.base, 0))
      : mode === "level"
        ? stats.every((s) => s.current !== null)
          ? String(stats.reduce((t, s) => t + (s.current ?? 0), 0))
          : "—"
        : stats.every((s) => s.fight !== null)
          ? String(stats.reduce((t, s) => t + (s.fight ?? 0), 0))
          : "—";
  const grid = mode === "base" ? "grid-cols-[46px_minmax(0,1fr)_54px]" : "grid-cols-[46px_minmax(0,1fr)_30px_36px_64px]";
  const lacks = [
    stats.some((s) => s.iv === null) && "ivs",
    stats.some((s) => s.ev === null) && "evs",
    !known && "stats",
  ].filter((x): x is Lack => typeof x === "string");
  return (
    <>
      {lacks.length > 0 && (
        <GapWarning>
          {t.lacking(lacks, mode === "fifty" && stats.some((s) => s.iv === null))}
        </GapWarning>
      )}
      <div role="radiogroup" aria-label={t.statsShown} className={trackClass}>
        {modes.map(([id, name]) => (
          <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)} className={segClass(mode === id)}>
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={cn("grid h-5.5 gap-x-2.5 px-3.5 font-heading text-[1.1875rem] text-muted-foreground", grid)}>
          {mode !== "base" && (
            <>
              <span />
              <span />
              <span className="text-right">IV</span>
              <span className="text-right">EV</span>
              <span className="text-right">{t.stat}</span>
            </>
          )}
        </div>
        {stats.map((s) => {
          const { ink, sign } = mark(s.stat);
          const iv = s.iv === null ? "—" : String(s.iv);
          return (
            <div key={s.stat} className={cn("grid h-13 items-center gap-x-2.5 rounded-[10px] bg-box px-3.5", grid)}>
              <span className={cn("font-heading text-[1.4375rem]", ink)}>
                {STAT_LABELS[s.stat]}
                {sign}
              </span>
              <span className="block h-4 overflow-hidden rounded-sm bg-ink">
                <span
                  className={cn("block h-full shadow-[inset_0_-4px_0_rgb(0_0_0/0.25)]", tint(ratio(s)))}
                  style={{ width: `${Math.min(100, Math.round(ratio(s) * 100))}%` }}
                />
              </span>
              {mode !== "base" && (
                <>
                  <span className={cn("text-right font-heading text-[1.375rem]", s.iv === 31 ? "text-yellow" : "text-subtle")}>{iv}</span>
                  <span className="text-right font-heading text-[1.375rem] text-subtle">
                    {mode === "fifty" && !mon.free ? "1" : s.ev === null ? "—" : s.ev}
                  </span>
                </>
              )}
              <span
                className={cn(
                  "text-right font-heading leading-none whitespace-nowrap text-white",
                  value(s).includes("–") ? "text-[1.25rem]" : "text-[1.875rem]",
                )}
              >
                {value(s)}
              </span>
            </div>
          );
        })}
        <div className={cn("grid min-h-10 items-center gap-x-2.5 px-3.5 font-heading text-[1.375rem] text-muted-foreground", grid)}>
          <span className={mode === "base" ? "col-span-2" : "col-span-4"}>{t.total}</span>
          <span className="text-right text-[1.625rem] text-foreground">{total}</span>
        </div>
      </div>
      {mode === "fifty" && (
        <p className="m-0 text-sm text-muted-foreground">
          {mon.free ? t.freeFifty : t.leagueFifty}
        </p>
      )}
    </>
  );
}

interface MoveRow {
  key: string;
  move: MoveInfo;
  known: boolean;
  label: string;
}

function Moves({ mon, tms, gaps }: { mon: Mon; tms: readonly BagTm[]; gaps: readonly ExportGap[] }) {
  const labels = useMemo(() => new Map(tms.map((t) => [t.move.id, t.label])), [tms]);
  const learn = mon.learnable;
  const rows = useMemo<MoveRow[]>(() => {
    if (!learn) return [];
    return [
      ...learn.current.map((move) => ({ key: `c${move.id}`, move, known: true, label: labels.get(move.id) ?? "" })),
      ...learn.relearner.map((move) => ({ key: `r${move.id}`, move, known: false, label: learn.levels?.[move.id] !== undefined ? t.lv(learn.levels[move.id]) : "" })),
      ...learn.tms.map((move) => ({ key: `t${move.id}`, move, known: false, label: labels.get(move.id) ?? "" })),
    ];
  }, [learn, labels]);
  const [picked, setPicked] = useState<string | null>(null);
  if (!learn) return <GapWarning>{t.noMoves}</GapWarning>;
  const selected = rows.find((r) => r.key === picked) ?? rows[0];
  const row = (r: MoveRow, withLabel: boolean) => {
    const on = r.key === selected?.key;
    return (
      <div
        key={r.key}
        className={cn("rounded-[10px] border-3", on ? "border-cell-hi bg-cell" : r.known ? "border-cell bg-box" : "border-transparent")}
      >
        <button
          type="button"
          aria-pressed={on}
          onClick={() => setPicked(r.key)}
          className={cn(
            "grid w-full cursor-pointer items-center gap-x-2 rounded-[7px] border-none bg-transparent pr-2 pl-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            withLabel ? "min-h-9 grid-cols-[40px_56px_minmax(0,1fr)_auto_26px]" : "min-h-10 grid-cols-[56px_minmax(0,1fr)_auto_26px]",
            !on && "hover:bg-face",
          )}
        >
          {withLabel && <span className="text-right font-heading text-[1.1875rem] text-subtle">{r.label}</span>}
          <TypeTag type={r.move.type} className="px-0 text-[1.0625rem] leading-5.5" />
          <span className={cn("min-w-0 truncate font-extrabold", withLabel ? "text-sm" : "text-[0.9375rem]")}>
            {r.move.name}
            {r.move.marked && <UnknownMark />}
          </span>
          <CategoryTag category={r.move.category} />
          <span className="text-right font-heading text-[1.3125rem] text-white">{r.move.power ?? "—"}</span>
        </button>
      </div>
    );
  };
  const learnRows = rows.filter((r) => !r.known);
  return (
    <>
      <div className="-mr-3.5 flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto overscroll-contain pr-2 [scrollbar-color:var(--cell-hi)_transparent] [scrollbar-width:thin]">
        <section aria-labelledby="sum-moves" className="flex flex-col gap-1">
          <h3 id="sum-moves" className="m-0 px-1 pb-0.5 font-heading text-xl leading-none font-normal text-muted-foreground">
            {t.moves}
          </h3>
          {rows.filter((r) => r.known).map((r) => row(r, false))}
        </section>
        {learnRows.length > 0 && (
          <section aria-labelledby="sum-learn" className="flex flex-col gap-0.5">
            <div className="grid grid-cols-[40px_56px_minmax(0,1fr)_auto_26px] items-end gap-x-2 pr-2.75 pb-1 pl-2.25 font-heading text-[1.1875rem] leading-none text-muted-foreground">
              <span />
              <h3 id="sum-learn" className="col-span-3 m-0 text-xl font-normal">
                {t.canLearn} <span className="text-faint">{learnCount(learn) - learn.current.length}</span>
              </h3>
              <span className="text-right">{t.pow}</span>
            </div>
            {learn.relearner.length > 0 && learn.levels === null && (
              <div className="mb-1">
                <GapWarning>{t.noLevels}</GapWarning>
              </div>
            )}
            {gaps.includes("tmRolls") && (
              <div className="mb-1">
                <GapWarning>{t.noTmRolls}</GapWarning>
              </div>
            )}
            {learnRows.map((r) => row(r, true))}
          </section>
        )}
      </div>
      {selected && (
        <section aria-label={t.selectedMove} aria-live="polite" className="flex min-h-37 flex-none flex-col gap-1.5 rounded-xl border-3 border-cell bg-box px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <TypeTag type={selected.move.type} className="flex-none px-2 text-lg leading-5.5" />
            <span className="min-w-0 flex-1 truncate font-heading text-[1.75rem] leading-none">{selected.move.name}</span>
            <CategoryTag category={selected.move.category} className="flex-none text-lg" />
          </div>
          <span className="flex gap-4 font-heading text-[1.1875rem] leading-[1.1] text-muted-foreground">
            <span>
              {t.power} <span className="text-foreground">{selected.move.power ?? "—"}</span>
            </span>
            <span>
              {t.accuracy} <span className="text-foreground">{selected.move.accuracy ?? "—"}</span>
            </span>
            {selected.label && <span className="text-foreground">{selected.label}</span>}
          </span>
          <p className="m-0 text-sm leading-[1.4] text-prose">{selected.move.desc || "—"}</p>
        </section>
      )}
    </>
  );
}

export function SummaryHead({ mon, title, closeRoom = false }: { mon: Mon; title: (text: string) => ReactNode; closeRoom?: boolean }) {
  return (
    <div className={cn("relative flex flex-none items-end gap-3.5 border-b-3 bg-box py-3 pl-3", closeRoom ? "pr-14" : "pr-5")}>
      <span className="relative flex h-28 w-30 flex-none items-end justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-x-3 bottom-1 h-6 rounded-[50%] opacity-50 shadow-[inset_0_-5px_0_rgb(0_0_0/0.28)]"
          style={typeStyle(mon.types[0] ?? null)}
        />
        <MonSprite mon={mon} className="relative size-24" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-2">
        {title(displayName(mon))}
        <span className="flex items-baseline gap-2 font-heading text-[1.375rem] whitespace-nowrap text-subtle">
          {mon.nickname && <span className="truncate">{mon.species.name} ·</span>}
          {!mon.nickname && mon.species.marked && <UnknownMark className="ml-0" />}
          <span>{t.level(mon.level ?? "?")}</span>
          {mon.gender === "M" && (
            <span className="text-stat-down">
              ♂<span className="sr-only">{t.male}</span>
            </span>
          )}
          {mon.gender === "F" && (
            <span className="text-female">
              ♀<span className="sr-only">{t.female}</span>
            </span>
          )}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {mon.types.map((t) => (
            <TypeTag key={t} type={t} />
          ))}
          {mon.fainted && <span className="rounded-sm border-2 border-destructive bg-destructive-soft px-1.5 font-heading text-lg leading-6 text-destructive">{t.fainted}</span>}
        </span>
      </div>
      {mon.shiny && (
        <span className={cn("absolute top-3 flex items-center", closeRoom ? "right-14" : "right-3.5", " gap-1.25 rounded-sm bg-yellow px-1.75 font-heading text-lg text-ink")}>
          <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className="size-2.5 fill-ink">
            <path d="M3 0h1v2H3zM0 3h2v1H0zM5 3h2v1H5zM3 5h1v2H3zM2 2h3v3H2z" />
          </svg>
          {t.shiny}
        </span>
      )}
    </div>
  );
}

export function SummaryBody({ mon, tms, gaps = [], series }: { mon: Mon; tms: readonly BagTm[]; gaps?: readonly ExportGap[]; series?: number }) {
  const [page, setPage] = useState<Page>("info");
  const pages: [Page, string][] = [
    ["info", t.info],
    ["stats", t.stats],
    ["moves", t.moves],
  ];
  return (
    <>
      <div role="tablist" aria-label={t.summary} className={cn(trackClass, "mx-5 mt-3.5 flex-none max-sm:mx-4")}>
        {pages.map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={page === id} onClick={() => setPage(id)} className={segClass(page === id)}>
            {name}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3.5 px-5 pt-3.5 pb-4.5 max-sm:px-4",
          page === "moves" ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {page === "info" ? <Info mon={mon} series={series} /> : page === "stats" ? <Stats mon={mon} /> : <Moves mon={mon} tms={tms} gaps={gaps} />}
      </div>
    </>
  );
}
