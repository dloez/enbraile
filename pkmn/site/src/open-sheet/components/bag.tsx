import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { describeItem, describeTm, type BagItem, type BagTm } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { TypeSquare, UnknownMark } from "@/open-sheet/components/marks";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type PocketId = "items" | "berries" | "tms";

function ItemIcon({ item }: { item: BagItem }) {
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

function Row({ icon, name, marked, sub, desc, qty }: {
  icon: ReactNode;
  name: string;
  marked: boolean;
  sub?: string;
  desc: string;
  qty?: string;
}) {
  return (
    <li className="grid grid-cols-[28px_1fr_auto] items-center gap-x-3 gap-y-1 border-b px-2 py-2.5">
      {icon}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold">
          {name}
          {marked && <UnknownMark />}
        </span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        {desc && <span className="text-[13px] text-muted-foreground">{desc}</span>}
      </span>
      <span className="text-right font-mono text-[13px] whitespace-nowrap text-muted-foreground">{qty}</span>
    </li>
  );
}

function tmSub(tm: BagTm): string {
  return [tm.label, tm.type, tm.category, tm.power, tm.accuracy !== null ? `${tm.accuracy}%` : null]
    .filter((part) => part !== null)
    .join(" · ");
}

export function Bag({ sheet, open, onOpenChange }: { sheet: Sheet; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pocket, setPocket] = useState<PocketId>("items");
  const [query, setQuery] = useState("");
  const items = useMemo(() => sheet.items.map(describeItem), [sheet]);
  const tms = useMemo(() => sheet.tms.map(describeTm), [sheet]);
  const q = query.trim().toLowerCase();

  const pockets: [PocketId, string, number][] = [
    ["items", "Items", items.filter((i) => i.pocket === "items").length],
    ["berries", "Berries", items.filter((i) => i.pocket === "berries").length],
    ["tms", "TMs", tms.length],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-auto bottom-0 flex h-[90svh] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-[20px] rounded-b-none border bg-card p-0 ring-0 sm:top-1/2 sm:bottom-auto sm:h-[calc(100svh-80px)] sm:max-w-180 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex flex-none items-center gap-3 pt-3 pr-2 pl-4.5">
          <DialogTitle className="min-w-0 flex-1 truncate font-heading text-xl leading-normal font-bold">Bag</DialogTitle>
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
                onClick={() => setPocket(id)}
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
          {pocket === "tms"
            ? tms
                .filter((tm) => !q || tm.move.name.toLowerCase().includes(q) || tm.label.toLowerCase().includes(q))
                .map((tm) => (
                  <Row
                    key={tm.label}
                    icon={<TypeSquare type={tm.type} />}
                    name={tm.move.name}
                    marked={tm.move.marked}
                    sub={tmSub(tm)}
                    desc={tm.desc}
                  />
                ))
            : items
                .filter((item) => item.pocket === pocket && (!q || item.name.toLowerCase().includes(q)))
                .map((item) => (
                  <Row
                    key={item.id}
                    icon={<ItemIcon item={item} />}
                    name={item.name}
                    marked={item.marked}
                    desc={item.desc}
                    qty={`×${item.quantity}`}
                  />
                ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
