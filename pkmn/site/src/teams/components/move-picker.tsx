import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CategoryTag, TypeTag } from "@/components/pc/summary";
import { UnknownMark } from "@/components/marks";
import { cn } from "@/lib/utils";
import { describeMove, describeTm } from "../../../shared/describe";
import { allowedMoves, displayName, tmLabels, type Mon, type MoveInfo } from "../../../shared/mon";
import type { FreePool, MoveRule } from "../../../shared/pool";
import { anyMoves, freeMoves, learnset, movesUpTo, type Learnset } from "@/teams/dex";
import type { Sheet } from "@/teams/schema";
import { EditorHead, editorScroll } from "@/teams/components/editors";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    current: "Current moves",
    relearner: "Move Relearner",
    tms: "TMs",
    all: "All moves",
    canLearn: "Can learn",
    other: "Other moves",
    levelUp: "Level up",
    machines: (gens: string) => `Gen ${gens} TMs`,
    replace: (move: string) => `replace ${move}`,
    move: (n: number) => `move ${n}`,
    searchMoves: "Search moves",
    search: "Search",
    leaveEmpty: "Leave the slot empty",
    lv: "Lv",
    category: "Category",
    pow: "Pow",
    acc: "Acc",
  },
  es: {
    current: "Movimientos actuales",
    relearner: "Recordador de movimientos",
    tms: "MT",
    all: "Todos los movimientos",
    canLearn: "Puede aprender",
    other: "Otros movimientos",
    levelUp: "Por nivel",
    machines: (gens: string) => `MT de la Gen ${gens}`,
    replace: (move: string) => `sustituir ${move}`,
    move: (n: number) => `movimiento ${n}`,
    searchMoves: "Buscar movimientos",
    search: "Buscar",
    leaveEmpty: "Dejar el hueco vacío",
    lv: "Nv",
    category: "Categoría",
    pow: "Pot",
    acc: "Prec",
  },
});

interface Option {
  move: MoveInfo;
  label: string;
}

export function useLearnset(species: string | null): Learnset | null {
  const [learned, setLearned] = useState<{ species: string; moves: Learnset } | null>(null);
  useEffect(() => {
    if (species === null) return;
    let live = true;
    learnset(species).then(
      (moves) => live && setLearned({ species, moves }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [species]);
  return learned && learned.species === species ? learned.moves : null;
}

function options(sheet: Sheet, mon: Mon, labels: Map<string, string>, movesGen: number, rule: MoveRule, freePool: FreePool, learned: Learnset | null): { name: string; moves: Option[] }[] {
  const learn = allowedMoves(mon, rule);
  if (learn) {
    const level = (id: string) => (learn.levels?.[id] !== undefined ? String(learn.levels[id]) : "");
    return [
      { name: t.current, moves: learn.current.map((move) => ({ move, label: labels.get(move.id) ?? "" })) },
      { name: t.relearner, moves: learn.relearner.map((move) => ({ move, label: level(move.id) })) },
      { name: t.tms, moves: learn.tms.map((move) => ({ move, label: labels.get(move.id) ?? "" })) },
    ];
  }
  if (mon.free) {
    const every = anyMoves().map((move) => ({ move, label: "" }));
    if (!learned) return freePool.tms === "any" ? [{ name: t.all, moves: every }] : [];
    const narrowed = freeMoves(learned, freePool);
    if (narrowed) {
      return [
        { name: t.levelUp, moves: every.filter((o) => narrowed.levelUp.has(o.move.id)) },
        { name: t.machines(narrowed.gens.join(", ")), moves: every.filter((o) => narrowed.tms.has(o.move.id)) },
      ];
    }
    return [
      { name: t.canLearn, moves: every.filter((o) => learned.has(o.move.id)) },
      { name: t.other, moves: every.filter((o) => !learned.has(o.move.id)) },
    ];
  }
  const all = movesUpTo(movesGen).map((move) => ({ move, label: "" }));
  const tms = sheet.tms.map(describeTm);
  return [
    { name: t.tms, moves: tms.map((tm) => ({ move: describeMove(tm.move.id), label: tm.label })) },
    { name: t.all, moves: all },
  ];
}

export function MoveEditor({ sheet, mon, movesGen, rule, freePool, moves, at, back, onBack, onPick }: {
  sheet: Sheet;
  mon: Mon;
  movesGen: number;
  rule: MoveRule;
  freePool: FreePool;
  moves: readonly (string | null)[];
  at: number;
  back: string;
  onBack: () => void;
  onPick: (move: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const labels = useMemo(() => tmLabels(sheet.tms), [sheet]);
  const learned = useLearnset(mon.free ? mon.species.id : null);
  const groups = useMemo(() => options(sheet, mon, labels, movesGen, rule, freePool, learned), [sheet, mon, labels, movesGen, rule, freePool, learned]);
  const q = query.trim().toLowerCase();
  const replacing = moves[at];
  const seen = new Set<string>();
  return (
    <>
      <EditorHead who={displayName(mon)} what={replacing ? t.replace(describeMove(replacing).name) : t.move(at + 1)} back={back} onBack={onBack} />
      <label className="flex min-h-11 flex-none items-center gap-2 rounded-[10px] border-3 bg-ink px-2.5 focus-within:border-primary">
        <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t.searchMoves}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none" />
      </label>
      <div className={cn(editorScroll, "gap-0.5")}>
        {replacing && !q && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="flex min-h-10 flex-none cursor-pointer items-center rounded-[10px] border-none bg-transparent px-2 text-left font-heading text-xl text-muted-foreground outline-none hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t.leaveEmpty}
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
              <h3 className="m-0 grid grid-cols-[28px_minmax(0,1fr)_60px_26px_28px] items-end gap-x-2 px-2 pt-2 pb-1 font-heading text-[1.125rem] leading-none font-normal text-muted-foreground">
                <span className="text-right">{group.name === t.relearner ? t.lv : ""}</span>
                <span>{group.name}</span>
                <span className="text-center whitespace-nowrap">{t.category}</span>
                <span className="text-right">{t.pow}</span>
                <span className="text-right">{t.acc}</span>
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
                    <span className="grid w-full grid-cols-[28px_52px_minmax(0,1fr)_60px_26px_28px] items-center gap-x-2">
                      <span className="text-right font-heading text-[1.3125rem] text-subtle">{label}</span>
                      <TypeTag type={move.type} className="px-0 text-base leading-5.25" />
                      <span className="min-w-0 truncate text-sm font-extrabold">
                        {move.name}
                        {move.marked && <UnknownMark />}
                      </span>
                      <CategoryTag category={move.category} className="justify-self-center text-base leading-5.25" />
                      <span className="text-right font-heading text-[1.3125rem] text-white">{move.power ?? "—"}</span>
                      <span className="text-right font-heading text-[1.3125rem] text-white">{move.accuracy ?? "—"}</span>
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
