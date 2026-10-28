import { cn } from "@/lib/utils";
import { Panel } from "@/components/controls";
import { displayName } from "../../../shared/mon";
import type { Slots, Stocks } from "@/teams/team";
import { analysed, defensiveChart, offensiveCoverage, speedOrder } from "@/teams/analysis";
import { TypeDot } from "@/components/marks";
import { MonSprite } from "@/components/pc/mon-sprite";
import { typeLabel } from "../../../shared/dex-text";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    speed: "Speed order",
    defence: "Defence",
    type: "Type",
    weak: "Weak",
    resist: "Resist",
    immune: "Immune",
    hole: "Hole",
    noHoles: "No holes.",
    holes: (types: string) => `Holes: ${types}.`,
    coverage: "Coverage",
    stab: "STAB",
    covered: "Every type is hit super-effectively.",
    uncovered: (types: string) => `Uncovered: ${types}.`,
  },
  es: {
    speed: "Orden de velocidad",
    defence: "Defensa",
    type: "Tipo",
    weak: "Débil",
    resist: "Resiste",
    immune: "Inmune",
    hole: "Hueco",
    noHoles: "Sin huecos.",
    holes: (types: string) => `Huecos: ${types}.`,
    coverage: "Cobertura",
    stab: "STAB",
    covered: "Todos los tipos reciben algún golpe supereficaz.",
    uncovered: (types: string) => `Sin cubrir: ${types}.`,
  },
});

function Count({ value, className }: { value: number; className: string }) {
  return <span className={cn("tabular-nums text-xs", value === 0 ? "text-muted-foreground/40" : className)}>{value}</span>;
}

export function TeamAnalysis({ slots, stocks, stacked = false }: { slots: Slots; stocks: Stocks; stacked?: boolean }) {
  const team = analysed(slots, stocks);
  if (team.length === 0) return null;
  const speed = speedOrder(team);
  const chart = defensiveChart(team);
  const { sources, rows } = offensiveCoverage(team);
  const uncovered = rows.filter((row) => row.hitters.length === 0);
  const holes = chart.filter((row) => row.hole);
  const nameOf = (slot: number) => {
    const entry = team.find((e) => e.slot === slot);
    return entry ? displayName(entry.mon) : "";
  };

  return (
    <div className={cn("grid grid-cols-1 gap-3.5", !stacked && "lg:grid-cols-2 xl:grid-cols-3")}>
      <Panel title={t.speed}>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {speed.map((entry, rank) => (
            <li key={entry.slot} className="flex items-center gap-2.5 rounded-lg bg-muted px-2.5 py-1.5 text-sm">
              <span className="w-4 tabular-nums text-xs text-muted-foreground">{rank + 1}</span>
              <MonSprite mon={entry.mon} className="size-8" />
              <span className="min-w-0 flex-1 truncate">{displayName(entry.mon)}</span>
              <span className="tabular-nums text-xs">{entry.low === entry.high ? entry.low : `${entry.low}–${entry.high}`}</span>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel title={t.defence}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1 text-left font-semibold">{t.type}</th>
              <th className="py-1 font-semibold">{t.weak}</th>
              <th className="py-1 font-semibold">{t.resist}</th>
              <th className="py-1 font-semibold">{t.immune}</th>
            </tr>
          </thead>
          <tbody>
            {chart.map((row) => (
              <tr key={row.type} className={cn("border-t", row.hole && "bg-destructive-soft")}>
                <td className="py-1 pl-1">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <TypeDot type={row.type} />
                    {typeLabel(row.type)}
                    {row.hole && <span className="text-xs font-bold text-destructive">{t.hole}</span>}
                  </span>
                </td>
                <td className="py-1 text-center">
                  <Count value={row.weak} className="text-destructive" />
                </td>
                <td className="py-1 text-center">
                  <Count value={row.resist} className="text-chart-2" />
                </td>
                <td className="py-1 text-center">
                  <Count value={row.immune} className="text-primary" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 text-xs text-muted-foreground">
          {holes.length === 0 ? t.noHoles : t.holes(holes.map((h) => typeLabel(h.type)).join(", "))}
        </p>
      </Panel>
      <Panel title={t.coverage} className={cn(!stacked && "lg:col-span-2 xl:col-span-1")}>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {sources.map((source) => (
            <li key={source.slot} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 truncate font-semibold">{displayName(source.mon)}</span>
              {source.types.map((type) => (
                <span key={type} className="inline-flex items-center gap-1 text-xs">
                  <TypeDot type={type} />
                  {typeLabel(type)}
                </span>
              ))}
              {source.stab && <span className="text-xs text-muted-foreground">{t.stab}</span>}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.type}
              title={row.hitters.length > 0 ? row.hitters.map(nameOf).join(", ") : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                row.hitters.length > 0 ? "bg-muted" : "bg-destructive-soft text-destructive",
              )}
            >
              <TypeDot type={row.type} />
              <span className="min-w-0 flex-1 truncate font-semibold">{typeLabel(row.type)}</span>
              <span className="tabular-nums">{row.hitters.length}</span>
            </div>
          ))}
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          {uncovered.length === 0
            ? t.covered
            : t.uncovered(uncovered.map((r) => typeLabel(r.type)).join(", "))}
        </p>
      </Panel>
    </div>
  );
}
