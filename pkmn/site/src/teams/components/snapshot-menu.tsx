import { useEffect, useState, type ReactNode } from "react";
import { PLAYER_FILL, playerColour } from "@/components/player-badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { snapshotList, type TeamSourceRow } from "../../../shared/team";

export function sourceLabel(source: TeamSourceRow): string {
  return `${source.player.name}'s PC · ${source.milestone}`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function SnapshotMenu({ label, taken = [], note, className, onClose, onPick }: {
  label: string;
  taken?: readonly string[];
  note?: ReactNode;
  className?: string;
  onClose: () => void;
  onPick: (row: TeamSourceRow) => void;
}) {
  const [rows, setRows] = useState<TeamSourceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api("/teams/snapshots", snapshotList).then(
      (list) => live && setRows(list),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, []);

  const left = (rows ?? []).filter((row) => !taken.includes(row.id));
  const series = [...new Set(left.map((row) => row.series.number))];

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-20" />
      <div
        role="menu"
        aria-label={label}
        className={cn(
          "absolute z-30 flex max-h-[min(28rem,70svh)] w-[min(19rem,calc(100vw-2rem))] flex-col gap-0.5 overflow-y-auto rounded-xl border-3 border-cell-hi bg-ink p-1.5 shadow-[0_8px_0_var(--edge)]",
          className,
        )}
      >
        {note}
        {error && (
          <p role="alert" className="m-0 px-2.5 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {!error && rows === null && <p className="m-0 px-2.5 py-2 font-heading text-xl text-muted-foreground">Loading…</p>}
        {rows !== null && left.length === 0 && <p className="m-0 px-2.5 py-2 font-heading text-xl text-muted-foreground">No other snapshots</p>}
        {series.map((number) => (
          <div key={number} role="group" aria-label={`Series ${number}`} className="flex flex-col gap-0.5">
            {series.length > 1 && <p className="m-0 px-2.5 pt-1.5 font-heading text-lg text-muted-foreground">Series {number}</p>}
            {left
              .filter((row) => row.series.number === number)
              .map((row) => (
                <button
                  key={row.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onClose();
                    onPick(row);
                  }}
                  className="flex min-h-11 flex-none cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 text-left font-heading text-[1.3125rem] text-foreground outline-none hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span aria-hidden="true" className={cn("grid size-5 flex-none place-items-center rounded-[5px] text-[0.9375rem] text-ink", PLAYER_FILL[playerColour(row.player.id) % PLAYER_FILL.length])}>
                    {row.player.name.charAt(0).toUpperCase()}
                  </span>
                  {sourceLabel(row)}
                </button>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
