import type { Member } from "@/analysis/member";
import type { Pool } from "@/analysis/pool";
import { ARCHETYPES, type Analysis, type ArchetypeName } from "@/analysis/team";
import { Panel } from "@/components/controls";
import { spriteOf } from "@/analysis/sprite";
import { messages } from "../../../shared/i18n";

const t = messages({
  en: {
    map: "Archetype map",
    mapAside: "bulk × offense percentile in the pool",
    mapLabel: "Team members, team average and archetype prototypes on bulk and offense percentiles",
    point: (who: string, bulk: number, offense: number, speed: number) => `${who}: bulk ${bulk}, offense ${offense}, speed ${speed}`,
    average: "Team average",
    bulk: "Bulk →",
    offense: "Offense →",
    median: "Median",
    p75: "75th percentile",
    fastest: "Fastest in pool",
    speed: "Speed",
    speedAside: "final Speed",
    benchmarks: (level: number) => `Pool benchmarks at level ${level}, 252 Spe, neutral nature`,
  },
  es: {
    map: "Mapa de arquetipos",
    mapAside: "percentil de aguante × ofensiva en la reserva",
    mapLabel: "Miembros del equipo, media del equipo y prototipos de arquetipo según sus percentiles de aguante y ofensiva",
    point: (who: string, bulk: number, offense: number, speed: number) => `${who}: aguante ${bulk}, ofensiva ${offense}, velocidad ${speed}`,
    average: "Media del equipo",
    bulk: "Aguante →",
    offense: "Ofensiva →",
    median: "Mediana",
    p75: "Percentil 75",
    fastest: "Más rápido de la reserva",
    speed: "Velocidad",
    speedAside: "Velocidad final",
    benchmarks: (level: number) => `Referencias de la reserva a nivel ${level}, 252 Vel, naturaleza neutra`,
  },
});

const at = (v: number) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(1)}%`;

export function ArchetypeMap({ team, analysis, pool }: { team: readonly Member[]; analysis: Analysis; pool: Pool }) {
  const cloud = pool.cloud();
  const fastest = Math.max(...analysis.members.map((m) => m.indices.speed), 0.01);
  return (
    <Panel title={t.map} aside={<span className="text-xs text-muted-foreground">{t.mapAside}</span>}>
      <div className="relative mb-5 ml-6.5 h-95 border-b border-l" role="img" aria-label={t.mapLabel}>
        {cloud.map((p) => (
          <span
            key={p.name}
            title={p.name}
            className="absolute -m-0.5 size-1.25 rounded-full bg-muted-foreground/30"
            style={{ left: at(p.x), bottom: at(p.y) }}
          />
        ))}
        {(Object.keys(ARCHETYPES) as ArchetypeName[]).map((name) => {
          const p = ARCHETYPES[name].proto;
          return (
            <span
              key={name}
              className="absolute flex -translate-x-1/2 translate-y-1/2 flex-col items-center gap-0.5"
              style={{ left: at(p.bulk), bottom: at(p.offense) }}
            >
              <span className="size-3 rotate-45 border-2 border-muted-foreground" />
              <span className="text-xs whitespace-nowrap text-muted-foreground">{ARCHETYPES[name].label}</span>
            </span>
          );
        })}
        {analysis.members.map((m, i) => {
          const size = 36 + (m.indices.speed / fastest) * 28;
          return (
            <img
              key={i}
              src={spriteOf(team[i])}
              alt={team[i].set.species}
              title={t.point(team[i].set.species, Math.round(m.indices.bulk * 100), Math.round(m.indices.offense * 100), Math.round(m.indices.speed * 100))}
              className="absolute -translate-x-1/2 translate-y-1/2 [image-rendering:pixelated]"
              style={{ left: at(m.indices.bulk), bottom: at(m.indices.offense), width: size, height: size }}
            />
          );
        })}
        <span
          className="absolute size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-3 border-background bg-primary"
          style={{ left: at(analysis.features.bulk), bottom: at(analysis.features.offense) }}
        />
        <span
          className="absolute translate-x-3 translate-y-1/2 text-xs font-semibold text-primary"
          style={{ left: at(analysis.features.bulk), bottom: at(analysis.features.offense) }}
        >
          {t.average}
        </span>
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">{t.bulk}</span>
        <span className="absolute top-1/2 -left-6 -rotate-90 text-xs text-muted-foreground">{t.offense}</span>
      </div>
    </Panel>
  );
}

function investedAt(base: number, level: number): number {
  return Math.floor(((2 * base + 31 + 63) * level) / 100) + 5;
}

export function SpeedTiers({ team, pool }: { team: readonly Member[]; pool: Pool }) {
  const level = team[0]?.set.level ?? 100;
  const order = team.map((m, i) => ({ m, i })).sort((a, b) => b.m.stats.spe - a.m.stats.spe);
  const benchmarks = [
    { label: t.median, v: investedAt(pool.quantile("spe", 0.5), level) },
    { label: t.p75, v: investedAt(pool.quantile("spe", 0.75), level) },
    { label: t.fastest, v: investedAt(pool.dist.spe.max, level) },
  ];
  const top = Math.max(...order.map((o) => o.m.stats.spe), benchmarks[2].v, 1);
  return (
    <Panel title={t.speed} aside={<span className="text-xs text-muted-foreground">{t.speedAside}</span>}>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {order.map(({ m, i }) => (
          <li key={i} className="grid grid-cols-[40px_minmax(0,104px)_minmax(0,1fr)_44px] items-center gap-2 text-sm">
            <img src={spriteOf(m)} alt="" className="size-10 [image-rendering:pixelated]" />
            <span className="truncate">{m.set.species}</span>
            <span className="h-3 rounded-sm bg-secondary">
              <span className="block h-3 rounded-sm bg-chart-2" style={{ width: `${(m.stats.spe / top) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{m.stats.spe}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-1.5 border-t pt-2">
        <span className="text-xs font-semibold text-muted-foreground">{t.benchmarks(level)}</span>
        {benchmarks.map((b) => (
          <div key={b.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{b.label}</span>
            <span className="tabular-nums">{b.v}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
