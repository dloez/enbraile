import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CategoryTag, TypeTag } from "@/components/pc/summary";
import { UnknownMark } from "@/components/marks";
import { cn } from "@/lib/utils";
import { describeMove, describeTm, displayName, MOVES, tmLabels, type Mon, type MoveInfo } from "@/teams/dex";
import type { Sheet } from "@/teams/schema";
import { EditorHead, editorScroll } from "@/teams/components/editors";

interface Option {
  move: MoveInfo;
  label: string;
}

function options(sheet: Sheet, mon: Mon, labels: Map<string, string>): { name: string; moves: Option[] }[] {
  const learn = mon.learnable;
  if (learn) {
    const level = (id: string) => (learn.levels?.[id] !== undefined ? String(learn.levels[id]) : "");
    return [
      { name: "Current moves", moves: learn.current.map((move) => ({ move, label: labels.get(move.id) ?? "" })) },
      { name: "Move Relearner", moves: learn.relearner.map((move) => ({ move, label: level(move.id) })) },
      { name: "TMs", moves: learn.tms.map((move) => ({ move, label: labels.get(move.id) ?? "" })) },
    ];
  }
  const tms = sheet.tms.map(describeTm);
  return [
    { name: "TMs", moves: tms.map((tm) => ({ move: describeMove(tm.move.id), label: tm.label })) },
    { name: "All moves", moves: MOVES.map((move) => ({ move, label: "" })) },
  ];
}

export function MoveEditor({ sheet, mon, moves, at, back, onBack, onPick }: {
  sheet: Sheet;
  mon: Mon;
  moves: readonly (string | null)[];
  at: number;
  back: string;
  onBack: () => void;
  onPick: (move: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const labels = useMemo(() => tmLabels(sheet.tms), [sheet]);
  const groups = useMemo(() => options(sheet, mon, labels), [sheet, mon, labels]);
  const q = query.trim().toLowerCase();
  const replacing = moves[at];
  const seen = new Set<string>();
  return (
    <>
      <EditorHead who={displayName(mon)} what={replacing ? `replace ${describeMove(replacing).name}` : `move ${at + 1}`} back={back} onBack={onBack} />
      <label className="flex min-h-11 flex-none items-center gap-2 rounded-[10px] border-3 bg-ink px-2.5 focus-within:border-primary">
        <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Search moves</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none" />
      </label>
      <div className={cn(editorScroll, "gap-0.5")}>
        {replacing && !q && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="flex min-h-10 flex-none cursor-pointer items-center rounded-[10px] border-none bg-transparent px-2 text-left font-heading text-xl text-muted-foreground outline-none hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Leave the slot empty
          </button>
        )}
        {groups.map((group) => {
          const shown = group.moves.filter((o) => {
            if (seen.has(o.move.id) || (q && !o.move.name.toLowerCase().includes(q) && !o.label.toLowerCase().includes(q))) return false;
            seen.add(o.move.id);
            return true;
          });
          if (shown.length === 0) return null;
          return (
            <section key={group.name} aria-label={group.name} className="flex flex-col gap-0.5">
              <h3 className="m-0 grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-2 px-2 pt-2 pb-1 font-heading text-[1.125rem] leading-none font-normal text-muted-foreground">
                <span className="text-right">{group.name === "Move Relearner" ? "Lv" : ""}</span>
                <span>{group.name}</span>
                <span>Pow</span>
              </h3>
              {shown.map(({ move, label }) => {
                const taken = moves.includes(move.id);
                return (
                  <button
                    key={move.id}
                    type="button"
                    disabled={taken}
                    onClick={() => onPick(move.id)}
                    className="flex flex-none cursor-pointer flex-col gap-px rounded-[10px] border-none bg-transparent pt-1.25 pr-2 pb-1.5 pl-1.5 text-left text-foreground outline-none enabled:hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-40"
                  >
                    <span className="grid w-full grid-cols-[28px_52px_minmax(0,1fr)_auto_26px] items-center gap-x-2">
                      <span className="text-right font-heading text-[1.3125rem] text-subtle">{label}</span>
                      <TypeTag type={move.type} className="px-0 text-base leading-5.25" />
                      <span className="min-w-0 truncate text-sm font-extrabold">
                        {move.name}
                        {move.marked && <UnknownMark />}
                      </span>
                      <CategoryTag category={move.category} className="text-base leading-5.25" />
                      <span className="text-right font-heading text-[1.3125rem] text-white">{move.power ?? "—"}</span>
                    </span>
                    {move.desc && <span className="pl-9 text-[0.8125rem] leading-[1.35] text-subtle">{move.desc}</span>}
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
