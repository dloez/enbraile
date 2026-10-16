import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayName, STAT_LABELS, tmLabels, type LearnMove, type Mon } from "@/open-sheet/dex";
import type { Sheet } from "@/open-sheet/schema";
import { TypeChip, TypeDot, UncheckedMark, UnknownMark } from "@/open-sheet/components/marks";

type Page = "info" | "stats" | "moves";

const PAGES: [Page, string][] = [
  ["info", "Info"],
  ["stats", "Stats"],
];

const GENDERS = { M: "Male", F: "Female", N: "Genderless" } as const;

export function MonSprite({ mon, className }: { mon: Mon; className?: string }) {
  if (!mon.sprite) {
    return (
      <span aria-hidden="true" className={cn("grid place-items-center font-heading text-2xl text-muted-foreground", className)}>
        ?
      </span>
    );
  }
  return <img src={mon.sprite} alt="" className={cn("[image-rendering:pixelated]", className)} />;
}

function subtitle(mon: Mon): string {
  const parts = [];
  if (mon.nickname) parts.push(mon.species.name);
  parts.push(`Lv ${mon.level ?? "?"}`);
  if (mon.gender === "M") parts.push("♂");
  if (mon.gender === "F") parts.push("♀");
  if (mon.shiny) parts.push("★");
  return parts.join(" · ");
}

function natureText(mon: Mon): ReactNode {
  const n = mon.nature;
  if (!n) return "—";
  return (
    <>
      {n.name}
      {n.plus && n.minus && n.plus !== n.minus && ` (+${STAT_LABELS[n.plus]} −${STAT_LABELS[n.minus]})`}
      {n.marked && <UnknownMark />}
    </>
  );
}

function Info({ mon }: { mon: Mon }) {
  const rows: [string, ReactNode][] = [
    [
      "Species",
      <>
        {mon.species.name}
        {mon.species.marked && <UnknownMark />}
      </>,
    ],
    ["Level", mon.level ?? "—"],
    ["Nature", natureText(mon)],
    ["Gender", mon.gender ? GENDERS[mon.gender] : "—"],
    ["Shiny", mon.shiny ? "Yes" : "No"],
  ];
  if (mon.nickname) rows.splice(1, 0, ["Nickname", mon.nickname]);
  return (
    <>
      <dl className="m-0 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 sm:grid-cols-[96px_1fr] sm:gap-y-2.25">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="m-0 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {mon.mismatch && mon.showdownTypes && (
        <p className="m-0 rounded-[10px] bg-destructive-soft px-3 py-2.5 text-[13px]">
          Save: {mon.types.join(" / ")} · Showdown: {mon.showdownTypes.join(" / ")}
        </p>
      )}
      {mon.abilities.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Ability</h3>
          {mon.abilities.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex flex-col gap-0.75 rounded-xl border px-3 py-2.5",
                a.current ? "border-primary bg-accent" : "border-border",
              )}
            >
              <div className="flex items-center gap-2">
                <strong className="flex-1">
                  {a.name}
                  {a.marked && <UnknownMark />}
                </strong>
                <span className={cn("text-xs", a.current ? "text-primary" : "text-muted-foreground")}>
                  {a.current ? "Current" : a.hidden ? "Hidden" : ""}
                </span>
              </div>
              {a.desc && <span className="text-[13px] text-muted-foreground">{a.desc}</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stats({ mon }: { mon: Mon }) {
  const n = mon.nature;
  return (
    <div className="grid grid-cols-[36px_32px_1fr_76px] items-center gap-x-2 gap-y-2.5 sm:grid-cols-[40px_34px_1fr_84px] sm:gap-x-2.5">
      <span />
      <span className="text-xs text-muted-foreground">Base</span>
      <span />
      <span className="text-right text-xs text-muted-foreground">Lv 50</span>
      {(mon.stats ?? []).map((s) => {
        const up = n?.plus === s.stat && n.minus !== s.stat;
        const down = n?.minus === s.stat && n.plus !== s.stat;
        return (
          <div key={s.stat} className="contents">
            <span className={cn("font-semibold", up ? "text-primary" : down ? "text-chart-2" : "text-foreground")}>
              {STAT_LABELS[s.stat]}
            </span>
            <span className="font-mono">{s.base}</span>
            <span className="h-2 overflow-hidden rounded-sm bg-muted">
              <span
                className={cn("block h-2 rounded-sm", up ? "bg-primary" : down ? "bg-chart-2" : "bg-chart-3")}
                style={{ width: `${Math.min(100, Math.round((s.base / 160) * 100))}%` }}
              />
            </span>
            <span className="text-right font-mono">
              {s.low}–{s.high}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function moveMeta(move: LearnMove): string {
  if (move.category === null) return "";
  if (move.category === "Status") return "Status";
  return `${move.category === "Physical" ? "Phys" : "Spec"} ${move.power ?? "—"}`;
}

function Moves({ mon, sheet }: { mon: Mon; sheet: Sheet }) {
  const [query, setQuery] = useState("");
  const labels = useMemo(() => tmLabels(sheet.tms), [sheet]);
  const learn = mon.learnable;
  if (!learn) return null;
  const q = query.trim().toLowerCase();
  const hit = (move: LearnMove) =>
    !q || move.name.toLowerCase().includes(q) || (labels.get(move.id) ?? "").toLowerCase().includes(q);
  const groups: [string, LearnMove[], boolean][] = [
    ["Move Relearner", learn.relearner, false],
    ["TMs", learn.tms, false],
    ["Not checked yet", learn.unchecked, true],
  ];
  return (
    <>
      <label className="flex min-h-10 items-center gap-2 rounded-lg border px-2.5">
        <Search className="size-4 flex-none" aria-hidden="true" />
        <span className="sr-only">Search moves</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      {groups.map(([name, moves, unchecked]) => {
        const shown = moves.filter(hit);
        if (moves.length === 0 || (q && shown.length === 0)) return null;
        return (
          <section key={name} aria-label={name} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <h3 className="m-0 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{name}</h3>
              <span className="font-mono text-xs text-muted-foreground">{moves.length}</span>
            </div>
            {unchecked && (
              <p className="m-0 rounded-[10px] bg-destructive-soft px-2.75 py-2.25 text-[13px]">
                The game has not checked these TMs against {mon.species.name} yet, so it may or may not learn them.
              </p>
            )}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {shown.map((move) => (
                <li
                  key={move.id}
                  className="grid grid-cols-[10px_1fr_auto_52px] items-center gap-2.5 rounded-lg px-2 py-1.75 odd:bg-muted"
                >
                  <TypeDot type={move.type} />
                  <span className="min-w-0 truncate font-medium">
                    {move.name}
                    {move.marked && <UnknownMark />}
                    {unchecked && <UncheckedMark />}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{moveMeta(move)}</span>
                  <span className="text-right font-mono text-xs text-muted-foreground">{labels.get(move.id) ?? ""}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function SummaryHead({ mon, title }: { mon: Mon; title: (text: string) => ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-3.5">
      <div className="grid size-20 flex-none place-items-center rounded-[14px] bg-box sm:size-24">
        <MonSprite mon={mon} className="size-20 sm:size-24" />
      </div>
      <div className="flex min-w-0 flex-col gap-1 sm:gap-1.25">
        {title(displayName(mon))}
        <span className="text-[13px] text-muted-foreground sm:text-sm">{subtitle(mon)}</span>
        <div className="flex flex-wrap gap-1.5">
          {mon.types.map((t) => (
            <TypeChip key={t} type={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SummaryBody({ mon, sheet }: { mon: Mon; sheet: Sheet }) {
  const [page, setPage] = useState<Page>("info");
  const learn = mon.learnable;
  const pages: [Page, string, number | null][] = [
    ...PAGES.map(([id, name]): [Page, string, number | null] => [id, name, null]),
    ...(learn
      ? [["moves", "Moves", learn.relearner.length + learn.tms.length + learn.unchecked.length] as [Page, string, number]]
      : []),
  ];
  return (
    <>
      <div role="tablist" aria-label="Summary" className="flex flex-none gap-1 border-b px-4 pt-2.5 sm:px-4.5 sm:pt-3">
        {pages.map(([id, name, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={page === id}
            onClick={() => setPage(id)}
            className={cn(
              "-mb-px min-h-11 cursor-pointer border-b-3 px-3 py-2.5 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              page === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {name}
            {count !== null && <span className="font-normal text-muted-foreground"> {count}</span>}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto px-4 py-3.5 sm:gap-4 sm:px-4.5 sm:py-4">
        {page === "info" ? <Info mon={mon} /> : page === "stats" ? <Stats mon={mon} /> : <Moves mon={mon} sheet={sheet} />}
      </div>
    </>
  );
}
