import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { canLearn, describeItem, describeTm, displayName, type BagItem, type Learn, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { GapWarning } from "@/components/pc/summary";
import type { ExportGap } from "../../../shared/snapshot";
import { heldCount, memberMon, type Slots } from "@/open-sheet/team";
import { UnknownMark } from "@/components/marks";
import { CategoryTag, MonSprite, TypeTag } from "@/components/pc/summary";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type PocketId = "items" | "berries" | "tms";

export function ItemIcon({ item, scale = 1 }: { item: BagItem; scale?: 1 | 2 | 3 }) {
  const box = scale === 3 ? "size-18" : scale === 2 ? "size-12" : "size-6";
  if (item.id === "tinymushroom") {
    return (
      <span className={cn("grid flex-none place-items-center", box)}>
        <svg viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true" className="size-3/4">
          <path d="M4 1h4v1H4zM2 2h8v1H2zM1 3h10v3H1z" className="fill-pixel-red" />
          <path d="M3 3h2v2H3zM8 2h1v2H8zM6 4h1v1H6z" className="fill-white" />
          <path d="M4 6h4v4H4zM3 10h6v1H3z" className="fill-seta-stem" />
        </svg>
      </span>
    );
  }
  return (
    <span className={cn("relative grid flex-none place-items-center overflow-hidden rounded-md", box, !item.icon && "bg-muted")}>
      {item.icon && (
        <span
          aria-hidden="true"
          className={cn("block size-6 flex-none [image-rendering:pixelated]", scale === 3 ? "scale-300" : scale === 2 ? "scale-200" : "")}
          style={{ background: `url(${item.icon.url}) no-repeat ${item.icon.left}px ${item.icon.top}px` }}
        />
      )}
    </span>
  );
}

function TmDisc({ type, className }: { type: string | null; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M3 0h4v1H3zM1 1h8v1H1zM0 2h10v6H0zM1 8h8v1H1zM3 9h4v1H3zM4 4h2v2H4z"
        style={{ fill: type ? `var(--type-${type.toLowerCase()}, var(--faint))` : "var(--faint)" }}
      />
      <path d="M2 2h2v1H2zM1 3h1v2H1z" className="fill-white/55" />
    </svg>
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

interface BagTeam {
  slots: Slots;
  mons: readonly Mon[];
  giveTo: number | null;
  onGive: (slot: number, item: string) => void;
  onTeach: (slot: number, move: string) => void;
}

interface BagProps {
  sheet: Sheet;
  gaps?: readonly ExportGap[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: BagTeam;
}

const NO_SLOTS: Slots = [];

const nothing = () => undefined;

export function Bag({ sheet, gaps = [], open, onOpenChange, team }: BagProps) {
  const readOnly = team === undefined;
  const slots = team?.slots ?? NO_SLOTS;
  const mons = team?.mons ?? [];
  const giveTo = team?.giveTo ?? null;
  const onGive = team?.onGive ?? nothing;
  const onTeach = team?.onTeach ?? nothing;
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
    else setPicked(key);
  }

  const pockets: [PocketId, string, number][] = [
    ["items", "Items", items.filter((i) => i.pocket === "items").length],
    ["berries", "Berries", items.filter((i) => i.pocket === "berries").length],
    ...(giveTo === null ? [["tms", "TMs", tms.length] as [PocketId, string, number]] : []),
  ];
  const shownTms = pocket === "tms" ? tms.filter((tm) => !q || tm.move.name.toLowerCase().includes(q) || tm.label.toLowerCase().includes(q)) : [];
  const shownItems = pocket === "tms" ? [] : items.filter((item) => item.pocket === pocket && (!q || item.name.toLowerCase().includes(q)));
  const firstKey = pocket === "tms" ? (shownTms[0] && `tm:${shownTms[0].label}`) : (shownItems[0] && `item:${shownItems[0].id}`);
  const selectedKey = picked ?? firstKey ?? null;
  const selectedTm = shownTms.find((tm) => `tm:${tm.label}` === selectedKey);
  const selectedItem = shownItems.find((item) => `item:${item.id}` === selectedKey);
  const rowClass = (on: boolean) =>
    cn(
      "w-full cursor-pointer rounded-[10px] border-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
      on ? "border-primary bg-cell" : "border-cell bg-card hover:border-primary",
    );
  const detailTargets = selectedTm
    ? targets.map((target) => ({ ...target, can: canLearn(target.mon, selectedTm.move.id) }))
    : selectedItem && selectedItem.known && selectedItem.quantity - heldCount(slots, selectedItem.id) > 0
      ? targets
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-auto bottom-0 flex h-[90svh] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border-3 border-cell-hi bg-card p-0 ring-0 sm:top-1/2 sm:bottom-auto sm:h-[min(780px,calc(100svh-80px))] sm:w-[min(1040px,calc(100vw-4rem))] sm:max-w-none sm:-translate-y-1/2 sm:rounded-[18px] sm:shadow-[0_12px_0_0_var(--edge)]"
      >
        <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-3 border-b-3 py-3 pr-3 pl-5 sm:py-4 sm:pr-4 sm:pl-6">
          <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" className="size-7.5 flex-none">
            <path d="M3 0h4v1H3zM2 1h1v2H2zM7 1h1v2H7z" className="fill-trophy-rim" />
            <path d="M1 3h8v1H1zM0 4h10v5H0zM1 9h8v1H1z" className="fill-orange" />
            <path d="M0 5h10v1H0z" className="fill-bag-strap" />
            <path d="M4 5h2v2H4z" className="fill-yellow" />
          </svg>
          <DialogTitle className="m-0 min-w-0 truncate font-heading text-[2.75rem] leading-none font-normal">
            {giveMon ? `Bag → ${displayName(giveMon)}` : "Bag"}
          </DialogTitle>
          {giveMon && <MonSprite mon={giveMon} className="size-10" />}
          <div role="tablist" aria-label="Pockets" className="order-last flex w-full gap-1 rounded-xl border-3 bg-ink p-1 sm:order-none sm:ml-3 sm:w-auto">
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
                  "flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-3.5 font-heading text-[1.4375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-none",
                  pocket === id ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
                )}
              >
                {name}
                <span className={pocket === id ? "text-subtle" : "text-faint"}>{count}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <label className="order-last flex h-12 w-full items-center gap-2 rounded-[10px] border-3 bg-ink px-3 focus-within:border-primary sm:order-none sm:w-55">
            <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Search the bag</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <DialogPrimitive.Close
            aria-label="Close the bag"
            className="grid size-12 flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-box px-4 py-3.5">
          {(pocket === "tms" ? gaps.includes("tms") : gaps.includes("items")) && (
            <div className="mb-3">
              <GapWarning>No {pocket === "tms" ? "TMs" : "items"} in this export</GapWarning>
            </div>
          )}
          {pocket === "tms" ? (
            <ul className="m-0 grid list-none gap-1.5 p-0 lg:grid-cols-2">
              {shownTms.map((tm) => {
                const key = `tm:${tm.label}`;
                const usable = readOnly || targets.some((target) => canLearn(target.mon, tm.move.id) !== "no");
                return (
                  <li key={tm.label}>
                    <button
                      type="button"
                      aria-pressed={key === selectedKey}
                      disabled={!usable}
                      onClick={() => choose(key, (slot) => onTeach(slot, tm.move.id))}
                      className={cn(rowClass(key === selectedKey), "grid min-h-13 grid-cols-[52px_56px_minmax(0,1fr)_auto_30px] items-center gap-x-2.5 px-3 disabled:opacity-50")}
                    >
                      <span className="font-heading text-[1.375rem] text-muted-foreground">{tm.label}</span>
                      <TypeTag type={tm.type} className="px-0 text-[1.0625rem] leading-5.5" />
                      <span className="min-w-0 truncate text-[0.9375rem] font-bold">
                        {tm.move.name}
                        {tm.move.marked && <UnknownMark />}
                      </span>
                      <CategoryTag category={tm.category} />
                      <span className="text-right font-heading text-[1.3125rem] text-white">{tm.power ?? "—"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {shownItems.map((item) => {
                const held = heldCount(slots, item.id);
                const left = item.quantity - held;
                const holder = giveTo !== null && slots[giveTo]?.item === item.id;
                const usable = readOnly || (item.known && targets.length > 0 && (left > 0 || holder));
                const key = `item:${item.id}`;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={key === selectedKey}
                      disabled={!usable}
                      onClick={() => choose(key, (slot) => onGive(slot, item.id))}
                      className={cn(rowClass(key === selectedKey), "flex min-h-14 items-center gap-2.5 py-0.5 pr-3.5 pl-1 disabled:opacity-50")}
                    >
                      <ItemIcon item={item} scale={2} />
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">
                        {item.name}
                        {item.marked && <UnknownMark />}
                      </span>
                      <span className={cn("flex-none font-heading text-2xl", left <= 0 ? "text-destructive" : "text-subtle")}>
                        {held > 0 ? `${left}/${item.quantity}` : `×${item.quantity}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {(pocket === "tms" ? shownTms : shownItems).length === 0 && (
            <p className="my-10 text-center font-heading text-[1.625rem] text-prose">{q ? "Nothing matches" : "Empty"}</p>
          )}
        </div>
        {(selectedTm || selectedItem) && (
          <div className="flex min-h-33 flex-none items-center gap-5 border-t-3 bg-card px-5 py-4 sm:px-6">
            <span className="grid size-24 flex-none place-items-center rounded-[14px] border-3 bg-box max-sm:size-18">
              {selectedTm ? <TmDisc type={selectedTm.type} className="size-16 max-sm:size-12" /> : selectedItem && <ItemIcon item={selectedItem} scale={3} />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
                {selectedTm && <span className="font-heading text-[1.625rem] text-muted-foreground">{selectedTm.label}</span>}
                <span className="font-heading text-[2.125rem] leading-none">{selectedTm ? selectedTm.move.name : selectedItem?.name}</span>
                {selectedItem && <span className="font-heading text-[1.625rem] text-subtle">×{selectedItem.quantity}</span>}
                {selectedTm && (
                  <span className="flex flex-wrap items-center gap-2">
                    <TypeTag type={selectedTm.type} />
                    <CategoryTag category={selectedTm.category} className="text-xl leading-normal" />
                    <span className="font-heading text-[1.375rem] text-muted-foreground">
                      Pow. <span className="text-foreground">{selectedTm.power ?? "—"}</span>
                    </span>
                    <span className="font-heading text-[1.375rem] text-muted-foreground">
                      Acc. <span className="text-foreground">{selectedTm.accuracy ?? "—"}</span>
                    </span>
                  </span>
                )}
              </span>
              <p className="m-0 text-base leading-[1.45] text-prose">{(selectedTm ? selectedTm.desc : selectedItem?.desc) || "—"}</p>
              {!readOnly && !giveMon && detailTargets.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {detailTargets.map((target) => (
                    <TargetButton
                      key={target.slot}
                      target={target}
                      move={selectedTm?.move.name}
                      onGive={(slot) => (selectedTm ? onTeach(slot, selectedTm.move.id) : selectedItem && onGive(slot, selectedItem.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
