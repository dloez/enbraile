import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChartNetwork, CircleAlert, ClipboardCheck, ClipboardCopy, Package, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { canLearn, currentAbility, describeItem, describeMove, displayName, STAT_LABELS, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { MINI_SETA, memberMon, quantityOf, setasNeeded, type Member, type Slots } from "@/open-sheet/team";
import { ItemIcon } from "@/open-sheet/components/bag";
import { buttonClass } from "@/components/controls";
import { TypeDot, UnknownMark } from "@/components/marks";
import { SheetAnalysis } from "@/open-sheet/components/sheet-analysis";
import { MovePicker } from "@/open-sheet/components/move-picker";
import { MonSprite } from "@/open-sheet/components/summary";
import { showdownTeam } from "@/open-sheet/showdown";
import { carryTeam } from "@/team-analysis/drafts";

interface TeamViewProps {
  sheet: Sheet;
  name: string;
  slots: Slots;
  mons: readonly Mon[];
  onOpen: (index: number) => void;
  onRemove: (slot: number) => void;
  onItem: (slot: number) => void;
  onTakeItem: (slot: number) => void;
  onAbility: (slot: number, ability: string | null) => void;
  onMove: (slot: number, at: number, move: string | null) => void;
  onAdd: () => void;
}

const field = "flex min-h-10.5 min-w-0 items-center gap-2 rounded-lg border bg-muted text-sm";

function MemberCard({ sheet, slot, member, mon, props }: {
  sheet: Sheet;
  slot: number;
  member: Member;
  mon: Mon;
  props: TeamViewProps;
}) {
  const [picking, setPicking] = useState<number | null>(null);
  const item = member.item ? describeItem({ item: member.item, quantity: 1 }) : null;
  const current = currentAbility(mon);
  const ability = member.ability ?? current;
  const n = mon.nature;
  const name = displayName(mon);
  const unlearnable = member.moves.flatMap((id) => (id && canLearn(mon, id) === "no" ? [describeMove(id).name] : []));

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border-3 bg-card">
      <div className="flex items-center gap-3 bg-box p-3">
        <button
          type="button"
          onClick={() => props.onOpen(mon.index)}
          aria-label={`Open ${name} in the PC`}
          className="grid size-16 flex-none cursor-pointer place-items-center rounded-xl bg-cell outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MonSprite mon={mon} className="size-16" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-heading text-2xl">{name}</span>
          <div className="flex flex-wrap items-center gap-2.5">
            {(mon.showdownTypes ?? mon.types).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.25 text-xs font-semibold">
                <TypeDot type={t} />
                {t}
              </span>
            ))}
            {n && <span className="text-xs text-muted-foreground">{n.name}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => props.onRemove(slot)}
          aria-label={`Remove ${name}`}
          className="grid size-9 flex-none cursor-pointer place-items-center rounded-lg text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className={cn(field, "pr-1")}>
            <button
              type="button"
              onClick={() => props.onItem(slot)}
              aria-label={item ? `Item: ${item.name}` : "Give an item"}
              className={cn(
                "flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg pl-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                item ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {item ? <ItemIcon item={item} /> : <Package className="size-4 flex-none" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate">
                {item ? item.name : "Item"}
                {item?.marked && <UnknownMark />}
              </span>
            </button>
            {item && (
              <button
                type="button"
                onClick={() => props.onTakeItem(slot)}
                aria-label={`Take ${item.name}`}
                title={`Take ${item.name}`}
                className="grid size-8 flex-none cursor-pointer place-items-center rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          {mon.abilities.length > 0 ? (
            <label className="flex min-w-0">
              <span className="sr-only">Ability</span>
              <select
                value={ability ?? ""}
                onChange={(event) => props.onAbility(slot, event.target.value || null)}
                className={cn(
                  field,
                  "flex-1 px-2 text-foreground",
                  member.ability !== null && "border-primary",
                )}
              >
                {current === null && <option value="">—</option>}
                {mon.abilities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.current ? a.name : `${a.name} · 1 Mini Seta`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className={cn(field, "px-2.5 text-muted-foreground")}>—</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {member.moves.map((id, at) => {
            const move = id ? describeMove(id) : null;
            const wrong = id !== null && canLearn(mon, id) === "no";
            return (
              <button
                key={at}
                type="button"
                onClick={() => setPicking(at)}
                aria-label={`Move ${at + 1}${move ? `: ${move.name}` : ""}${wrong ? `, which ${name} can't learn` : ""}`}
                className={cn(
                  field,
                  "cursor-pointer px-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  move ? "text-foreground" : "text-muted-foreground",
                  wrong && "border-destructive bg-destructive-soft",
                )}
              >
                <TypeDot type={move?.type ?? null} />
                <span className="min-w-0 flex-1 truncate">
                  {move ? move.name : "—"}
                  {move?.marked && <UnknownMark />}
                </span>
                {wrong && <CircleAlert className="size-4 flex-none text-destructive" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {unlearnable.length > 0 && (
          <p className="m-0 text-sm text-destructive">
            {name} can't learn {unlearnable.join(", ")} in this save.
          </p>
        )}
        <div className="grid grid-cols-6 gap-1 border-t pt-1">
          {(mon.stats ?? []).map((s) => {
            const up = n?.plus === s.stat && n.minus !== s.stat;
            const down = n?.minus === s.stat && n.plus !== s.stat;
            return (
              <div key={s.stat} className="flex flex-col items-center gap-px pt-1.5">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    up ? "text-primary" : down ? "text-chart-2" : "text-muted-foreground",
                  )}
                >
                  {STAT_LABELS[s.stat]}
                </span>
                {s.fight !== null ? (
                  <span className="tabular-nums text-xs">{s.fight}</span>
                ) : (
                  <>
                    <span className="tabular-nums text-xs">{s.high}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">{s.low}</span>
                  </>
                )}
                <span className="tabular-nums text-xs text-muted-foreground/60">{s.base}</span>
              </div>
            );
          })}
        </div>
      </div>
      <MovePicker
        sheet={sheet}
        mon={mon}
        title={`${name} · Move ${(picking ?? 0) + 1}`}
        current={picking === null ? null : member.moves[picking]}
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
        onPick={(move) => picking !== null && props.onMove(slot, picking, move)}
      />
    </article>
  );
}

function OpenInAnalysis({ slots, mons }: { slots: Slots; mons: readonly Mon[] }) {
  const navigate = useNavigate();
  const text = showdownTeam(slots, mons);
  return (
    <button
      type="button"
      disabled={text === ""}
      onClick={() => {
        carryTeam(text);
        void navigate({ to: "/team-analysis" });
      }}
      className={cn(buttonClass, "ml-auto")}
    >
      <ChartNetwork className="size-4" aria-hidden="true" />
      Open in Team Analysis
    </button>
  );
}

function CopyButton({ slots, mons }: { slots: Slots; mons: readonly Mon[] }) {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const text = showdownTeam(slots, mons);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      disabled={text === ""}
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setCopied("copied"),
          () => setCopied("failed"),
        )
      }
      className={buttonClass}
    >
      {copied === "copied" ? (
        <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
      ) : (
        <ClipboardCopy className="size-4" aria-hidden="true" />
      )}
      {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy for Showdown"}
    </button>
  );
}

export function TeamView(props: TeamViewProps) {
  const { sheet, name, slots, mons } = props;
  const needed = setasNeeded(slots, mons);
  const owned = quantityOf(sheet, MINI_SETA);
  const short = needed > owned;

  return (
    <div className="flex flex-col gap-4.5 pt-1 pb-3 sm:pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 font-heading text-4xl">{name}</h2>
        <span
          title="Mini Setas"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.75 py-1.25 text-sm font-semibold",
            short ? "bg-destructive-soft text-destructive" : "bg-accent text-primary",
          )}
        >
          <span className="tabular-nums">
            {needed}/{owned}
          </span>
          Mini Seta
        </span>
        <OpenInAnalysis slots={slots} mons={mons} />
        <CopyButton slots={slots} mons={mons} />
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((member, slot) => {
          const mon = memberMon(member, mons);
          if (!member || !mon) {
            return (
              <article key={slot} className="flex min-w-0 flex-col rounded-2xl border-3 bg-card">
                <button
                  type="button"
                  onClick={props.onAdd}
                  aria-label="Add a Pokémon from the PC"
                  className="m-2.5 grid min-h-30 flex-1 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-75"
                >
                  <Plus className="size-6" aria-hidden="true" />
                </button>
              </article>
            );
          }
          return <MemberCard key={slot} sheet={sheet} slot={slot} member={member} mon={mon} props={props} />;
        })}
      </div>
      <SheetAnalysis slots={slots} mons={mons} />
    </div>
  );
}
