import { Check, ChevronRight, Plus, X } from "lucide-react";
import { ItemIcon, MiniSeta, Mint } from "@/components/pc/bag";
import { MonSprite } from "@/components/pc/mon-sprite";
import { TypeTag } from "@/components/pc/summary";
import { TypeDot, UnknownMark } from "@/components/marks";
import { PLAYER_FILL } from "@/components/player-badge";
import { cn } from "@/lib/utils";
import { canLearn, currentAbility, displayName, type Mon } from "../../../shared/mon";
import { describeItem, describeMove } from "../../../shared/describe";
import { MOVE_RULE_LABELS, type MoveRule } from "../../../shared/pool";
import { setasLabel } from "@/teams/components/editors";
import { moveGen } from "@/teams/dex";
import type { Member } from "@/teams/team";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    mintBag: "A mint from the bag",
    mintMoney: "A mint bought with money",
    leaveOut: (name: string) => `Leave ${name} out of the six`,
    putIn: (name: string) => `Put ${name} in the six`,
    leaveOutTitle: "Leave out of the six",
    putInTitle: "Put in the six",
    back: "Back to the analysis",
    summary: (name: string) => `Summary of ${name}`,
    lv: "Lv.",
    pc: (owner: string) => `${owner}'s PC`,
    free: "Free",
    setTitle: "Level, nature, EVs and IVs",
    set: "Set",
    takeOut: (name: string) => `Take ${name} out`,
    takeOutTitle: "Take out of the team",
    item: "Item",
    noItem: "No item",
    ability: "Ability: ",
    costs: (setas: string) => `Costs ${setas}`,
    natureTitle: (nature: string) => `${nature} Nature`,
    nature: "Nature: ",
    noNature: "No nature",
    late: (move: string, gen: number, movesGen: number) => `${move} is from Gen ${gen}, past the pool's moves up to Gen ${movesGen}`,
    unlearnable: (name: string, move: string) => `${name} can't learn ${move} in this save`,
    ruled: (move: string, rule: string) => `${move} is outside the team's moves (${rule})`,
    empty: "Empty",
    add: "Add a Pokémon",
  },
  es: {
    mintBag: "Una menta de la mochila",
    mintMoney: "Una menta comprada con dinero",
    leaveOut: (name: string) => `Dejar a ${name} fuera de los seis`,
    putIn: (name: string) => `Meter a ${name} en los seis`,
    leaveOutTitle: "Dejar fuera de los seis",
    putInTitle: "Meter en los seis",
    back: "Volver al análisis",
    summary: (name: string) => `Resumen de ${name}`,
    lv: "Nv.",
    pc: (owner: string) => `PC de ${owner}`,
    free: "Libre",
    setTitle: "Nivel, naturaleza, EVs e IVs",
    set: "Set",
    takeOut: (name: string) => `Sacar a ${name}`,
    takeOutTitle: "Sacar del equipo",
    item: "Objeto",
    noItem: "Sin objeto",
    ability: "Habilidad: ",
    costs: (setas: string) => `Cuesta ${setas}`,
    natureTitle: (nature: string) => `Naturaleza ${nature}`,
    nature: "Naturaleza: ",
    noNature: "Sin naturaleza",
    late: (move: string, gen: number, movesGen: number) => `${move} es de la Gen ${gen}, posterior a los movimientos de la reserva (hasta la Gen ${movesGen})`,
    unlearnable: (name: string, move: string) => `${name} no puede aprender ${move} en esta partida`,
    ruled: (move: string, rule: string) => `${move} queda fuera de los movimientos del equipo (${rule})`,
    empty: "Vacío",
    add: "Añadir un Pokémon",
  },
});

export type Focus = "look" | "item" | "ability" | "nature" | "set" | { move: number } | null;

const field = (on: boolean) =>
  cn(
    "flex min-w-0 items-center rounded-[10px] border-3 text-left text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer enabled:hover:border-primary disabled:cursor-default",
    on ? "border-primary bg-cell" : "border-cell bg-box",
  );

export interface PickToggle {
  in: boolean;
  off: boolean;
  onToggle: () => void;
}

export function MemberCard({ member, mon, from, focus, glow, editable, pick, natureFrom, setaCost, movesGen, moveRule, onLook, onItem, onAbility, onNature, onMove, onSet, onRemove }: {
  member: Member;
  mon: Mon;
  from: { owner: string; colour: number } | null;
  focus: Focus;
  glow: boolean;
  editable: boolean;
  pick?: PickToggle;
  natureFrom: "mint" | "money" | null;
  setaCost: number;
  movesGen: number;
  moveRule: MoveRule;
  onLook: () => void;
  onItem: () => void;
  onAbility: () => void;
  onNature: () => void;
  onMove: (at: number) => void;
  onSet: () => void;
  onRemove: () => void;
}) {
  const name = displayName(mon);
  const item = member.item ? describeItem({ item: member.item, quantity: 1 }) : null;
  const current = currentAbility(mon);
  const abilityId = member.ability ?? current;
  const ability = mon.abilities.find((a) => a.id === abilityId);
  const costs = from !== null && member.ability !== null;
  const mintTitle = natureFrom === "mint" ? t.mintBag : t.mintMoney;
  const looking = focus === "look";
  const lit = focus !== null && !looking;
  return (
    <article
      aria-label={name}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col justify-between gap-2 rounded-[14px] border-3 bg-card pt-1.5 pr-3 pb-3 pl-1.5 short:gap-1.5 short:pb-2",
        glow ? "border-yellow shadow-[0_0_0_3px_color-mix(in_srgb,var(--yellow)_35%,transparent)]" : lit ? "border-primary" : pick?.in ? "border-green" : "border-border",
        pick && !pick.in && "opacity-55",
      )}
    >
      {pick && (
        <button
          type="button"
          role="checkbox"
          aria-checked={pick.in}
          aria-label={pick.in ? t.leaveOut(name) : t.putIn(name)}
          title={pick.in ? t.leaveOutTitle : t.putInTitle}
          disabled={pick.off}
          onClick={pick.onToggle}
          className="group absolute top-0 left-0 z-1 grid size-11 place-items-center rounded-[14px] border-none bg-transparent p-0 outline-none enabled:cursor-pointer disabled:cursor-default"
        >
          <span
            className={cn(
              "grid size-6.5 place-items-center rounded-md border-3 group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
              pick.in ? "border-green bg-green text-ink" : "border-cell-hi bg-ink group-enabled:group-hover:border-green",
              pick.off && "opacity-45",
            )}
          >
            {pick.in && <Check className="size-4" strokeWidth={3.5} aria-hidden="true" />}
          </span>
        </button>
      )}
      <div className="flex min-h-15 items-center gap-2 short:min-h-13">
        <button
          type="button"
          aria-pressed={looking}
          onClick={onLook}
          title={looking ? t.back : t.summary(name)}
          className={cn(
            "flex min-h-15 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[10px] border-3 pr-3 text-left text-foreground outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 short:min-h-13",
            looking ? "border-primary bg-cell" : "border-cell bg-box",
          )}
        >
          <span className="flex h-21 w-18 flex-none items-center justify-center overflow-hidden short:h-13 short:w-14">
            <MonSprite mon={mon} className="size-full object-contain" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.75">
            <span className="min-w-0 truncate font-heading text-[1.75rem] leading-[0.9]">{name}</span>
            <span className="flex min-w-0 items-center gap-1.25 overflow-hidden">
              {(mon.showdownTypes ?? mon.types).map((type) => (
                <TypeTag key={type} type={type} className="flex-none px-2 text-[1.0625rem] leading-5.25" />
              ))}
              <span className="ml-1 min-w-0 truncate font-heading text-[1.1875rem] text-muted-foreground">
                {t.lv} {mon.level ?? "?"}
              </span>
            </span>
          </span>
          {from ? (
            <span className={cn("flex-none rounded-sm px-1.75 font-heading text-[1.0625rem] text-ink", PLAYER_FILL[from.colour % PLAYER_FILL.length])}>{t.pc(from.owner)}</span>
          ) : (
            <span className="flex-none rounded-sm border-2 border-dashed border-faint px-1.5 font-heading text-[1.0625rem] text-subtle">{t.free}</span>
          )}
          <ChevronRight className={cn("size-5 flex-none", looking ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
        </button>
        {editable && !from && (
          <button
            type="button"
            aria-pressed={focus === "set"}
            onClick={onSet}
            title={t.setTitle}
            className={cn(
              "h-8.5 flex-none cursor-pointer rounded-lg border-3 bg-cell px-2.25 font-heading text-lg text-subtle outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
              focus === "set" ? "border-primary" : "border-cell-hi",
            )}
          >
            {t.set}
          </button>
        )}
        {editable && (
          <button
            type="button"
            aria-label={t.takeOut(name)}
            title={t.takeOutTitle}
            onClick={onRemove}
            className="grid size-8.5 flex-none cursor-pointer place-items-center rounded-lg border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(6rem,0.75fr)] gap-2">
        <button
          type="button"
          aria-pressed={focus === "item"}
          disabled={!editable}
          onClick={onItem}
          title={item?.desc}
          className={cn(field(focus === "item"), "h-9.5 gap-1.5 pr-2 pl-1 short:h-8.5")}
        >
          {item ? <ItemIcon item={item} /> : <span className="flex-none pl-1 font-heading text-lg text-muted-foreground">{t.item}</span>}
          <span className={cn("min-w-0 flex-1 truncate text-sm font-extrabold", !item && "text-muted-foreground")}>
            {item ? item.name : t.noItem}
            {item?.marked && <UnknownMark />}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={focus === "ability"}
          disabled={!editable}
          onClick={onAbility}
          title={ability?.desc}
          className={cn(field(focus === "ability"), "h-9.5 gap-1.5 px-2 short:h-8.5")}
        >
          <span className="sr-only">{t.ability}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{ability?.name ?? "—"}</span>
          {costs && (
            <span title={t.costs(setasLabel(setaCost))} className="grid size-5 flex-none place-items-center">
              <MiniSeta className="size-4" />
              <span className="sr-only">{t.costs(setasLabel(setaCost))}</span>
            </span>
          )}
        </button>
        <button
          type="button"
          aria-pressed={focus === "nature"}
          disabled={!editable}
          onClick={onNature}
          title={mon.nature ? `${t.natureTitle(mon.nature.name)}${natureFrom ? `: ${mintTitle.toLowerCase()}` : ""}` : undefined}
          className={cn(field(focus === "nature"), "h-9.5 gap-1 px-2 short:h-8.5")}
        >
          <span className="sr-only">{t.nature}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{mon.nature?.name ?? t.noNature}</span>
          {natureFrom && (
            <span title={mintTitle} className="flex flex-none items-center gap-0.5">
              <Mint className="size-4" />
              {natureFrom === "money" && <span className="font-heading text-base leading-none text-warning">$</span>}
              <span className="sr-only">{mintTitle}</span>
            </span>
          )}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2 short:gap-1">
        {member.moves.map((id, at) => {
          const move = id ? describeMove(id) : null;
          const introduced = id !== null && mon.free ? moveGen(id) : null;
          const late = introduced !== null && introduced > movesGen;
          const unlearnable = id !== null && canLearn(mon, id, "any") === "no";
          const ruled = id !== null && !unlearnable && canLearn(mon, id, moveRule) === "no";
          const wrong = late || unlearnable || ruled;
          const on = typeof focus === "object" && focus !== null && focus.move === at;
          return (
            <button
              key={at}
              type="button"
              aria-pressed={on}
              disabled={!editable}
              onClick={() => onMove(at)}
              title={late ? t.late(move?.name ?? "", introduced, movesGen) : unlearnable ? t.unlearnable(name, move?.name ?? "") : ruled ? t.ruled(move?.name ?? "", MOVE_RULE_LABELS[moveRule]) : move?.desc}
              className={cn(
                field(on),
                "grid min-h-9 grid-cols-[52px_minmax(0,1fr)_24px_23px] gap-x-1.5 pr-2 pl-1.25 short:min-h-7.5 lg:grid-cols-[20px_minmax(0,1fr)_24px]",
                wrong && !on && "border-destructive bg-destructive-soft",
              )}
            >
              <TypeTag type={move?.type ?? null} className="px-0 text-base leading-5.25 lg:sr-only" />
              {move ? <TypeDot type={move.type} className="hidden size-5 lg:inline-grid" /> : <span aria-hidden="true" className="hidden size-5 rounded-full bg-faint lg:block" />}
              <span className={cn("min-w-0 truncate text-sm font-extrabold", !move && "text-muted-foreground")}>
                {move ? move.name : "—"}
                {move?.marked && <UnknownMark />}
              </span>
              <span className="contents lg:flex lg:flex-col lg:items-end">
                <span className="text-right font-heading text-xl text-subtle lg:text-base lg:leading-[0.8]">{move ? (move.power ?? "—") : ""}</span>
                <span className="text-right font-heading text-sm text-muted-foreground lg:leading-[0.8]">{move ? (move.accuracy === null ? "—" : `${move.accuracy}%`) : ""}</span>
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

export function EmptyCard({ editable, on, onAdd }: { editable: boolean; on: boolean; onAdd: () => void }) {
  if (!editable) {
    return <span className="grid min-h-82.5 flex-1 place-items-center rounded-[14px] border-3 border-dashed font-heading text-2xl text-faint lg:min-h-0">{t.empty}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onAdd}
      className={cn(
        "flex min-h-82.5 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-3 border-dashed font-heading text-muted-foreground outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 lg:min-h-0",
        on ? "border-primary bg-primary/10" : "border-cell-hi bg-transparent",
      )}
    >
      <Plus className="size-7" aria-hidden="true" />
      <span className="text-[1.625rem] leading-none">{t.add}</span>
    </button>
  );
}
