import { Check, ChevronRight, Plus, X } from "lucide-react";
import { ItemIcon, MiniSeta, Mint } from "@/components/pc/bag";
import { MonSprite } from "@/components/pc/mon-sprite";
import { TypeTag } from "@/components/pc/summary";
import { UnknownMark } from "@/components/marks";
import { PLAYER_FILL } from "@/components/player-badge";
import { cn } from "@/lib/utils";
import { canLearn, currentAbility, displayName, type Mon } from "../../../shared/mon";
import { describeItem, describeMove } from "../../../shared/describe";
import { setasLabel } from "@/teams/components/editors";
import { moveGen } from "@/teams/dex";
import type { Member } from "@/teams/team";

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

export function MemberCard({ member, mon, from, focus, glow, editable, pick, natureFrom, setaCost, movesGen, onLook, onItem, onAbility, onNature, onMove, onSet, onRemove }: {
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
  const mintTitle = natureFrom === "mint" ? "A mint from the bag" : "A mint bought with money";
  const looking = focus === "look";
  const lit = focus !== null && !looking;
  return (
    <article
      aria-label={name}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col gap-2 rounded-[14px] border-3 bg-card pt-1.5 pr-3 pb-3 pl-1.5",
        glow ? "border-yellow shadow-[0_0_0_3px_color-mix(in_srgb,var(--yellow)_35%,transparent)]" : lit ? "border-primary" : pick?.in ? "border-green" : "border-border",
        pick && !pick.in && "opacity-55",
      )}
    >
      {pick && (
        <button
          type="button"
          role="checkbox"
          aria-checked={pick.in}
          aria-label={pick.in ? `Leave ${name} out of the six` : `Put ${name} in the six`}
          title={pick.in ? "Leave out of the six" : "Put in the six"}
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
      <div className="flex min-h-15 items-center gap-2">
        <button
          type="button"
          aria-pressed={looking}
          onClick={onLook}
          title={looking ? "Back to the analysis" : `Summary of ${name}`}
          className={cn(
            "flex min-h-15 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[10px] border-3 pr-3 text-left text-foreground outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
            looking ? "border-primary bg-cell" : "border-cell bg-box",
          )}
        >
          <span className="flex h-21 w-18 flex-none items-center justify-center overflow-hidden">
            <MonSprite mon={mon} className="-mx-1.5 size-21 flex-none" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.75">
            <span className="min-w-0 truncate font-heading text-[1.75rem] leading-[0.9]">{name}</span>
            <span className="flex min-w-0 items-center gap-1.25 overflow-hidden">
              {(mon.showdownTypes ?? mon.types).map((t) => (
                <TypeTag key={t} type={t} className="flex-none px-2 text-[1.0625rem] leading-5.25" />
              ))}
              <span className="ml-1 min-w-0 truncate font-heading text-[1.1875rem] text-muted-foreground">
                Lv. {mon.level ?? "?"}
              </span>
            </span>
          </span>
          {from ? (
            <span className={cn("flex-none rounded-sm px-1.75 font-heading text-[1.0625rem] text-ink", PLAYER_FILL[from.colour % PLAYER_FILL.length])}>{from.owner}'s PC</span>
          ) : (
            <span className="flex-none rounded-sm border-2 border-dashed border-faint px-1.5 font-heading text-[1.0625rem] text-subtle">Free</span>
          )}
          <ChevronRight className={cn("size-5 flex-none", looking ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
        </button>
        {editable && !from && (
          <button
            type="button"
            aria-pressed={focus === "set"}
            onClick={onSet}
            title="Level, nature, EVs and IVs"
            className={cn(
              "h-8.5 flex-none cursor-pointer rounded-lg border-3 bg-cell px-2.25 font-heading text-lg text-subtle outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
              focus === "set" ? "border-primary" : "border-cell-hi",
            )}
          >
            Set
          </button>
        )}
        {editable && (
          <button
            type="button"
            aria-label={`Take ${name} out`}
            title="Take out of the team"
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
          className={cn(field(focus === "item"), "h-9.5 gap-1.5 pr-2 pl-1")}
        >
          {item ? <ItemIcon item={item} /> : <span className="flex-none pl-1 font-heading text-lg text-muted-foreground">Item</span>}
          <span className={cn("min-w-0 flex-1 truncate text-sm font-extrabold", !item && "text-muted-foreground")}>
            {item ? item.name : "No item"}
            {item?.marked && <UnknownMark />}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={focus === "ability"}
          disabled={!editable}
          onClick={onAbility}
          title={ability?.desc}
          className={cn(field(focus === "ability"), "h-9.5 gap-1.5 px-2")}
        >
          <span className="sr-only">Ability: </span>
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{ability?.name ?? "—"}</span>
          {costs && (
            <span title={`Costs ${setasLabel(setaCost)}`} className="grid size-5 flex-none place-items-center">
              <MiniSeta className="size-4" />
              <span className="sr-only">Costs {setasLabel(setaCost)}</span>
            </span>
          )}
        </button>
        <button
          type="button"
          aria-pressed={focus === "nature"}
          disabled={!editable}
          onClick={onNature}
          title={mon.nature ? `${mon.nature.name} Nature${natureFrom ? `: ${mintTitle.toLowerCase()}` : ""}` : undefined}
          className={cn(field(focus === "nature"), "h-9.5 gap-1 px-2")}
        >
          <span className="sr-only">Nature: </span>
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{mon.nature?.name ?? "No nature"}</span>
          {natureFrom && (
            <span title={mintTitle} className="flex flex-none items-center gap-0.5">
              <Mint className="size-4" />
              {natureFrom === "money" && <span className="font-heading text-base leading-none text-warning">$</span>}
              <span className="sr-only">{mintTitle}</span>
            </span>
          )}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {member.moves.map((id, at) => {
          const move = id ? describeMove(id) : null;
          const introduced = id !== null && mon.free ? moveGen(id) : null;
          const late = introduced !== null && introduced > movesGen;
          const wrong = late || (id !== null && canLearn(mon, id) === "no");
          const on = typeof focus === "object" && focus !== null && focus.move === at;
          return (
            <button
              key={at}
              type="button"
              aria-pressed={on}
              disabled={!editable}
              onClick={() => onMove(at)}
              title={late ? `${move?.name} is from Gen ${introduced}, past the pool's moves up to Gen ${movesGen}` : wrong ? `${name} can't learn ${move?.name} in this save` : move?.desc}
              className={cn(
                field(on),
                "grid min-h-9 grid-cols-[52px_minmax(0,1fr)_24px] gap-x-1.75 pr-2 pl-1.25",
                wrong && !on && "border-destructive bg-destructive-soft",
              )}
            >
              <TypeTag type={move?.type ?? null} className="px-0 text-base leading-5.25" />
              <span className={cn("min-w-0 truncate text-sm font-extrabold", !move && "text-muted-foreground")}>
                {move ? move.name : "—"}
                {move?.marked && <UnknownMark />}
              </span>
              <span className="text-right font-heading text-xl text-subtle">{move ? (move.power ?? "—") : ""}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

export function EmptyCard({ editable, on, onAdd }: { editable: boolean; on: boolean; onAdd: () => void }) {
  if (!editable) {
    return <span className="grid min-h-61.5 flex-1 place-items-center rounded-[14px] border-3 border-dashed font-heading text-2xl text-faint">Empty</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onAdd}
      className={cn(
        "flex min-h-61.5 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-3 border-dashed font-heading text-muted-foreground outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50",
        on ? "border-primary bg-primary/10" : "border-cell-hi bg-transparent",
      )}
    >
      <Plus className="size-7" aria-hidden="true" />
      <span className="text-[1.625rem] leading-none">Add a Pokémon</span>
    </button>
  );
}
