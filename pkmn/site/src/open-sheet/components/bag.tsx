import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { canLearn, describeItem, describeTm, displayName, type BagItem, type BagTm, type Learn, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { heldCount, memberMon, type Slots } from "@/open-sheet/team";
import { TypeSquare, UnknownMark } from "@/components/marks";
import { MonSprite } from "@/open-sheet/components/summary";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type PocketId = "items" | "berries" | "tms";

export function ItemIcon({ item }: { item: BagItem }) {
  return (
    <span className={cn("relative block size-6 overflow-hidden rounded-md", !item.icon && "bg-muted")}>
      {item.icon && (
        <span
          aria-hidden="true"
          className="block size-6 [image-rendering:pixelated]"
          style={{ background: `url(${item.icon.url}) no-repeat ${item.icon.left}px ${item.icon.top}px` }}
        />
      )}
    </span>
  );
}

interface Target {
  slot: number;
  mon: Mon;
  can?: Learn | null;
}

function TargetButton({ target, move, onGive }: { target: Target; move?: string; onGive: (slot: number) => void }) {
  const name = displayName(target.mon);
  const no = target.can === "no";
  const label = no ? `${name} can't learn ${move}` : name;
  const button = (
    <button
      type="button"
      disabled={no}
      aria-label={label}
      title={label}
      onClick={() => onGive(target.slot)}
      className="relative grid size-13 cursor-pointer place-items-center rounded-lg border bg-box outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-35"
    >
      <MonSprite mon={target.mon} className="size-12" />
    </button>
  );
  if (target.can === undefined || target.can === null) return button;
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      {button}
      <span className={cn("text-center text-xs", no ? "text-muted-foreground" : "text-foreground")}>
        {no ? "Can't learn" : name}
      </span>
    </div>
  );
}

function Row({ icon, name, marked, sub, desc, qty, spent, usable, open, targets, onClick, onGive }: {
  icon: ReactNode;
  name: string;
  marked: boolean;
  sub?: string;
  desc: string;
  qty?: string;
  spent?: boolean;
  usable: boolean;
  open: boolean;
  targets: Target[];
  onClick: () => void;
  onGive: (slot: number) => void;
}) {
  return (
    <li className={cn("rounded-lg border-b", open && "bg-muted")}>
      <button
        type="button"
        disabled={!usable}
        aria-expanded={open}
        onClick={onClick}
        className="grid w-full cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-x-3 gap-y-1 px-2 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50"
      >
        {icon}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">
            {name}
            {marked && <UnknownMark />}
          </span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          {desc && <span className="text-sm text-muted-foreground">{desc}</span>}
        </span>
        <span
          className={cn(
            "text-right font-mono text-sm whitespace-nowrap",
            spent ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {qty}
        </span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 pr-2 pb-3 pl-12">
          {targets.map((target) => (
            <TargetButton key={target.slot} target={target} move={name} onGive={onGive} />
          ))}
        </div>
      )}
    </li>
  );
}

function tmSub(tm: BagTm): string {
  return [tm.label, tm.type, tm.category, tm.power, tm.accuracy !== null ? `${tm.accuracy}%` : null]
    .filter((part) => part !== null)
    .join(" · ");
}

interface BagProps {
  sheet: Sheet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: Slots;
  mons: readonly Mon[];
  giveTo: number | null;
  onGive: (slot: number, item: string) => void;
  onTeach: (slot: number, move: string) => void;
}

export function Bag({ sheet, open, onOpenChange, slots, mons, giveTo, onGive, onTeach }: BagProps) {
  const [pocket, setPocket] = useState<PocketId>("items");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    if (giveTo !== null) setPocket((current) => (current === "tms" ? "items" : current));
  }, [open, giveTo]);
  const items = useMemo(() => sheet.items.map(describeItem), [sheet]);
  const tms = useMemo(() => sheet.tms.map(describeTm), [sheet]);
  const q = query.trim().toLowerCase();
  const targets: Target[] = slots.flatMap((member, slot) => {
    const mon = memberMon(member, mons);
    return mon ? [{ slot, mon }] : [];
  });
  const giveMon = giveTo === null ? undefined : memberMon(slots[giveTo], mons);

  function choose(key: string, give: (slot: number) => void) {
    if (giveTo !== null && giveMon) give(giveTo);
    else setPicked(picked === key ? null : key);
  }

  const pockets: [PocketId, string, number][] = [
    ["items", "Items", items.filter((i) => i.pocket === "items").length],
    ["berries", "Berries", items.filter((i) => i.pocket === "berries").length],
    ...(giveTo === null ? [["tms", "TMs", tms.length] as [PocketId, string, number]] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-auto bottom-0 flex h-[90svh] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border bg-card p-0 ring-0 sm:top-1/2 sm:bottom-auto sm:h-[calc(100svh-80px)] sm:max-w-180 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex flex-none items-center gap-3 pt-3 pr-2 pl-4.5">
          <DialogTitle className="min-w-0 flex-1 truncate font-heading text-xl leading-normal font-bold">
            {giveMon ? `Bag → ${displayName(giveMon)}` : "Bag"}
          </DialogTitle>
          {giveMon && <MonSprite mon={giveMon} className="size-10" />}
          <DialogPrimitive.Close
            aria-label="Close the bag"
            className="grid size-11 cursor-pointer place-items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex flex-none flex-wrap items-end gap-2 border-b px-4.5 pt-2">
          <div role="tablist" aria-label="Pockets" className="flex gap-1">
            {pockets.map(([id, name, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pocket === id}
                onClick={() => {
                  setPocket(id);
                  setPicked(null);
                }}
                className={cn(
                  "-mb-px min-h-11 cursor-pointer border-b-3 px-2.5 py-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  pocket === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
                )}
              >
                {name} <span className="font-normal text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <label className="mb-1.5 flex min-h-9.5 max-w-55 flex-[1_1_140px] items-center gap-1.5 rounded-lg border px-2.5">
            <Search className="size-3.75 flex-none" aria-hidden="true" />
            <span className="sr-only">Search the bag</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
        </div>
        <ul className="m-0 min-h-0 flex-1 list-none overflow-auto px-2.5 py-1.5">
          {pocket === "tms" && giveTo === null
            ? tms
                .filter((tm) => !q || tm.move.name.toLowerCase().includes(q) || tm.label.toLowerCase().includes(q))
                .map((tm) => {
                  const key = `tm:${tm.label}`;
                  const tmTargets = targets.map((target) => ({ ...target, can: canLearn(target.mon, tm.move.id) }));
                  const usable = tmTargets.some((target) => target.can !== "no");
                  return (
                    <Row
                      key={tm.label}
                      icon={<TypeSquare type={tm.type} />}
                      name={tm.move.name}
                      marked={tm.move.marked}
                      sub={tmSub(tm)}
                      desc={tm.desc}
                      usable={usable}
                      open={!giveMon && picked === key}
                      targets={tmTargets}
                      onClick={() => choose(key, (slot) => onTeach(slot, tm.move.id))}
                      onGive={(slot) => onTeach(slot, tm.move.id)}
                    />
                  );
                })
            : items
                .filter((item) => item.pocket === pocket && (!q || item.name.toLowerCase().includes(q)))
                .map((item) => {
                  const held = heldCount(slots, item.id);
                  const left = item.quantity - held;
                  const holder = giveTo !== null && slots[giveTo]?.item === item.id;
                  const usable = item.known && targets.length > 0 && (left > 0 || holder);
                  const key = `item:${item.id}`;
                  return (
                    <Row
                      key={item.id}
                      icon={<ItemIcon item={item} />}
                      name={item.name}
                      marked={item.marked}
                      desc={item.desc}
                      qty={held > 0 ? `${left}/${item.quantity}` : `×${item.quantity}`}
                      spent={left <= 0}
                      usable={usable}
                      open={usable && !giveMon && picked === key}
                      targets={targets}
                      onClick={() => choose(key, (slot) => onGive(slot, item.id))}
                      onGive={(slot) => onGive(slot, item.id)}
                    />
                  );
                })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
