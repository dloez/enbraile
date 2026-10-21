import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { describeTm, displayName, learnCount, MOVES, moveStats, tmLabels, type Mon, type MoveInfo } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { TypeSquare, UnknownMark } from "@/components/marks";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MovePickerProps {
  sheet: Sheet;
  mon: Mon;
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
  const stats = moveStats(move);
  return (
    <li>
      <button
        type="button"
        aria-pressed={current}
        onClick={onPick}
        className={cn(
          "grid min-h-14 w-full cursor-pointer grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[24px_minmax(0,1fr)_auto] sm:items-center",
          current ? "bg-cell-hi" : "hover:bg-cell",
        )}
      >
        <TypeSquare type={move.type} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 font-semibold">
              {move.name}
              {move.marked && <UnknownMark />}
            </span>
            {label && <span className="font-mono text-xs text-muted-foreground sm:hidden">{label}</span>}
          </span>
          {stats && <span className="font-mono text-xs text-muted-foreground sm:hidden">{stats}</span>}
          {move.desc && <span className="text-sm text-muted-foreground">{move.desc}</span>}
        </span>
        <span className="hidden flex-col items-end gap-0.5 font-mono text-xs whitespace-nowrap text-muted-foreground sm:flex">
          <span>{stats}</span>
          {label && <span>{label}</span>}
        </span>
      </button>
    </li>
  );
}

function Group({ name, count, children }: { name: string; count?: number; children: ReactNode }) {
  return (
    <section aria-label={name} className="flex flex-col gap-0.5">
      <h3 className="m-0 px-2.5 pt-2 pb-1 text-sm font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {name}
        {count !== undefined && <span className="ml-2 font-mono font-normal tracking-normal">{count}</span>}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>
    </section>
  );
}

export function MovePicker({ sheet, mon, title, current, open, onOpenChange, onPick }: MovePickerProps) {
  const [query, setQuery] = useState("");
  const tms = useMemo(() => sheet.tms.map(describeTm), [sheet]);
  const labels = useMemo(() => tmLabels(sheet.tms), [sheet]);
  const q = query.trim().toLowerCase();
  const hit = (name: string) => !q || name.toLowerCase().includes(q);
  const learn = mon.learnable;
  const groups: [string, MoveInfo[]][] = learn
    ? [
        ["Current moves", learn.current],
        ["Move Relearner", learn.relearner],
        ["TMs", learn.tms],
      ]
    : [
        ["TMs", tms.map((tm) => ({ ...tm.move, type: tm.type, category: tm.category, power: tm.power, accuracy: tm.accuracy, desc: tm.desc }))],
        ["All moves", [...MOVES]],
      ];
  const learnTotal = learn ? learnCount(learn) : 0;

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
        className="top-auto bottom-0 flex h-[94svh] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border bg-card p-0 ring-0 sm:top-1/2 sm:bottom-auto sm:h-[calc(100svh-80px)] sm:max-w-190 sm:-translate-y-1/2 sm:rounded-2xl"
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
        <div className="flex flex-none flex-col gap-2 border-b px-4.5 pt-2 pb-2.5">
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
          {learn && (
            <span className="text-xs text-muted-foreground">
              Only the {learnTotal} moves {displayName(mon)} can learn in this save
            </span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-2.5 py-1.5">
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
          {groups.map(([name, moves]) => {
            const shown = moves.filter((move) => hit(move.name) || hit(labels.get(move.id) ?? ""));
            if (shown.length === 0) return null;
            return (
              <Group key={name} name={name} count={learn ? moves.length : undefined}>
                {shown.map((move, at) => (
                  <MoveRow
                    key={`${name}:${move.id}:${at}`}
                    move={move}
                    label={name === "All moves" ? undefined : labels.get(move.id)}
                    current={move.id === current}
                    onPick={() => pick(move.id)}
                  />
                ))}
              </Group>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
