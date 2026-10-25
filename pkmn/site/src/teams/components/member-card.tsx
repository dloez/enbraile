import { ChevronRight, Plus, X } from "lucide-react";
import { ItemIcon, MiniSeta } from "@/components/pc/bag";
import { MonSprite, TypeTag } from "@/components/pc/summary";
import { UnknownMark } from "@/components/marks";
import { PLAYER_FILL } from "@/components/player-badge";
import { cn } from "@/lib/utils";
import { canLearn, currentAbility, describeItem, describeMove, displayName, type Mon } from "@/teams/dex";
import type { Member } from "@/teams/team";

export type Focus = "look" | "item" | "ability" | { move: number } | null;

const field = (on: boolean) =>
  cn(
    "flex min-w-0 items-center rounded-[10px] border-3 text-left text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer enabled:hover:border-primary disabled:cursor-default",
    on ? "border-primary bg-cell" : "border-cell bg-box",
  );

export function MemberCard({ member, mon, from, colour, focus, glow, editable, onLook, onItem, onAbility, onMove, onRemove }: {
  member: Member;
  mon: Mon;
  from: string;
  colour: number;
  focus: Focus;
  glow: boolean;
  editable: boolean;
  onLook: () => void;
  onItem: () => void;
  onAbility: () => void;
  onMove: (at: number) => void;
  onRemove: () => void;
}) {
  const name = displayName(mon);
  const item = member.item ? describeItem({ item: member.item, quantity: 1 }) : null;
  const current = currentAbility(mon);
  const abilityId = member.ability ?? current;
  const ability = mon.abilities.find((a) => a.id === abilityId);
  const costs = member.ability !== null;
  const looking = focus === "look";
  const lit = focus !== null && !looking;
  return (
    <article
      aria-label={name}
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-between gap-1.5 rounded-[14px] border-3 bg-card pt-1.5 pr-3 pb-3 pl-1.5",
        glow ? "border-yellow shadow-[0_0_0_3px_color-mix(in_srgb,var(--yellow)_35%,transparent)]" : lit ? "border-primary" : "border-border",
      )}
    >
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
          <span className="flex h-15 w-18 flex-none items-center justify-center overflow-hidden">
            <MonSprite mon={mon} className="-mx-1.5 -mt-3.5 -mb-2.5 size-21 flex-none" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.75">
            <span className="min-w-0 truncate font-heading text-[1.75rem] leading-[0.9]">{name}</span>
            <span className="flex min-w-0 items-center gap-1.25">
              {(mon.showdownTypes ?? mon.types).map((t) => (
                <TypeTag key={t} type={t} className="flex-none px-2 text-[1.0625rem] leading-5.25" />
              ))}
              <span className="ml-1 min-w-0 truncate font-heading text-[1.1875rem] text-muted-foreground">
                Lv. {mon.level ?? "?"} · {mon.nature?.name ?? "?"}
              </span>
            </span>
          </span>
          <span className={cn("flex-none rounded-sm px-1.75 font-heading text-[1.0625rem] text-ink", PLAYER_FILL[colour % PLAYER_FILL.length])}>{from}'s PC</span>
          <ChevronRight className={cn("size-5 flex-none", looking ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
        </button>
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
      <div className="grid grid-cols-2 gap-2">
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
          <span className="flex-none font-heading text-lg text-muted-foreground">Ability</span>
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{ability?.name ?? "—"}</span>
          {costs && (
            <span title="Costs 1 Mini Seta" className="grid size-5 flex-none place-items-center">
              <MiniSeta className="size-4" />
              <span className="sr-only">Costs 1 Mini Seta</span>
            </span>
          )}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {member.moves.map((id, at) => {
          const move = id ? describeMove(id) : null;
          const wrong = id !== null && canLearn(mon, id) === "no";
          const on = typeof focus === "object" && focus !== null && focus.move === at;
          return (
            <button
              key={at}
              type="button"
              aria-pressed={on}
              disabled={!editable}
              onClick={() => onMove(at)}
              title={wrong ? `${name} can't learn ${move?.name} in this save` : move?.desc}
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
    return <span className="grid min-h-30 flex-1 place-items-center rounded-[14px] border-3 border-dashed font-heading text-2xl text-faint">Empty</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onAdd}
      className={cn(
        "flex min-h-30 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-3 border-dashed font-heading text-muted-foreground outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50",
        on ? "border-primary bg-primary/10" : "border-cell-hi bg-transparent",
      )}
    >
      <Plus className="size-7" aria-hidden="true" />
      <span className="text-[1.625rem] leading-none">Add a Pokémon</span>
    </button>
  );
}
