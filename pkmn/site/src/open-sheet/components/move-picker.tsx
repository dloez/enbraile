import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { describeTm, MOVES, type MoveInfo } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { TypeDot, UnknownMark } from "@/open-sheet/components/marks";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MovePickerProps {
  sheet: Sheet;
  title: string;
  current: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (move: string | null) => void;
}

function MoveRow({ move, label, current, onPick }: {
  move: MoveInfo;
  label?: string;
  current: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={current}
        onClick={onPick}
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          current ? "bg-accent" : "hover:bg-cell",
        )}
      >
        <TypeDot type={move.type} />
        <span className="flex-1 font-medium">
          {move.name}
          {move.marked && <UnknownMark />}
        </span>
        {label && <span className="font-mono text-xs text-muted-foreground">{label}</span>}
      </button>
    </li>
  );
}

function Group({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section aria-label={name} className="flex flex-col gap-0.5">
      <h3 className="m-0 px-2.5 pt-2 pb-1 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{name}</h3>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>
    </section>
  );
}

export function MovePicker({ sheet, title, current, open, onOpenChange, onPick }: MovePickerProps) {
  const [query, setQuery] = useState("");
  const tms = useMemo(() => sheet.tms.map(describeTm), [sheet]);
  const q = query.trim().toLowerCase();
  const hit = (name: string) => !q || name.toLowerCase().includes(q);
  const shownTms = tms.filter((tm) => hit(tm.move.name) || hit(tm.label));
  const shownMoves = MOVES.filter((move) => hit(move.name));

  function pick(move: string | null) {
    onPick(move);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-auto bottom-0 flex h-[90svh] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-[20px] rounded-b-none border bg-card p-0 ring-0 sm:top-1/2 sm:bottom-auto sm:h-[calc(100svh-80px)] sm:max-w-120 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex flex-none items-center gap-3 pt-3 pr-2 pl-4.5">
          <DialogTitle className="min-w-0 flex-1 truncate font-heading text-xl leading-normal font-bold">{title}</DialogTitle>
          <DialogPrimitive.Close
            aria-label="Close"
            className="grid size-11 cursor-pointer place-items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex flex-none border-b px-4.5 pt-2 pb-2.5">
          <label className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border px-2.5">
            <Search className="size-4 flex-none" aria-hidden="true" />
            <span className="sr-only">Search moves</span>
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2 py-1.5">
          {current !== null && !q && (
            <ul className="m-0 list-none p-0">
              <li>
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className="flex min-h-11 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-muted-foreground outline-none hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  —
                </button>
              </li>
            </ul>
          )}
          {shownTms.length > 0 && (
            <Group name="TMs">
              {shownTms.map((tm) => (
                <MoveRow
                  key={tm.label}
                  move={{ ...tm.move, type: tm.type }}
                  label={tm.label}
                  current={tm.move.id === current}
                  onPick={() => pick(tm.move.id)}
                />
              ))}
            </Group>
          )}
          {shownMoves.length > 0 && (
            <Group name="All moves">
              {shownMoves.map((move) => (
                <MoveRow key={move.id} move={move} current={move.id === current} onPick={() => pick(move.id)} />
              ))}
            </Group>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
