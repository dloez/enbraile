import { Check, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ARCHETYPES, FEATURES, type Analysis, type CheckLevel, type Features } from "@/analysis/team";
import { Panel } from "@/components/controls";

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const RADIUS = 78;

function point(v: number, i: number, r = RADIUS): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / FEATURES.length;
  return [Math.cos(a) * r * v, Math.sin(a) * r * v];
}

function polygon(values: readonly number[]): string {
  return values.map((v, i) => point(Math.max(0, Math.min(1, v)), i).map((n) => n.toFixed(1)).join(",")).join(" ");
}

export interface RadarSeries {
  name: string;
  features: Features;
  stroke: string;
  fill: string;
  dashed?: boolean;
}

export function Radar({ series, label, size = 240 }: { series: readonly RadarSeries[]; label: string; size?: number }) {
  return (
    <svg viewBox="-160 -112 320 224" role="img" aria-label={label} className="h-auto max-w-full flex-none" style={{ width: size }}>
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={polygon(FEATURES.map(() => r))} className="fill-none stroke-border" />
      ))}
      {series.map((s) => (
        <polygon
          key={s.name}
          points={polygon(FEATURES.map((f) => s.features[f.key]))}
          strokeWidth={2}
          strokeDasharray={s.dashed ? "5 4" : undefined}
          className={cn(s.stroke, s.fill)}
        />
      ))}
      {FEATURES.map((f, i) => {
        const [x, y] = point(1.2, i);
        return (
          <text
            key={f.key}
            x={x.toFixed(1)}
            y={(y + 3).toFixed(1)}
            textAnchor={Math.abs(x) < 4 ? "middle" : x > 0 ? "start" : "end"}
            className="fill-chart-3 text-xs"
          >
            {f.label}
          </text>
        );
      })}
    </svg>
  );
}

export function ArchetypeCard({ analysis }: { analysis: Analysis }) {
  const [top] = analysis.archetype;
  const proto = ARCHETYPES[top.name];
  return (
    <Panel title="Archetype" aside={<span className="text-xs text-muted-foreground">closest prototype</span>}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading text-4xl leading-none font-bold text-primary">{top.name}</span>
            <span className="font-mono text-lg">{pct(top.pct)}</span>
          </div>
          {analysis.archetype.map((a, i) => (
            <div key={a.name} className="grid grid-cols-[112px_minmax(0,1fr)_40px] items-center gap-2 text-sm">
              <span>{a.name}</span>
              <span className="h-2 overflow-hidden rounded-sm bg-secondary">
                <span className={cn("block h-2 rounded-sm", i === 0 ? "bg-primary" : "bg-chart-3")} style={{ width: pct(a.pct) }} />
              </span>
              <span className="text-right font-mono text-xs">{pct(a.pct)}</span>
            </div>
          ))}
        </div>
        <Radar
          label={`Archetype fingerprint against the ${top.name} prototype`}
          series={[
            { name: "proto", features: proto.proto, stroke: "stroke-muted-foreground", fill: "fill-none", dashed: true },
            { name: "team", features: analysis.features, stroke: "stroke-primary", fill: "fill-primary/15" },
          ]}
        />
      </div>
      <p className="m-0 text-sm leading-normal text-chart-3">{proto.blurb}</p>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {proto.wants.map((w) => (
          <li key={w} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-chart-3">
            {w}
          </li>
        ))}
      </ul>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 bg-primary" />
          Team
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3.5 border-t-2 border-dashed border-muted-foreground" />
          {top.name} prototype
        </span>
      </div>
    </Panel>
  );
}

const LEVEL: Record<CheckLevel, { icon: typeof Check; box: string; mark: string; label: string }> = {
  bad: { icon: X, box: "bg-destructive-soft", mark: "bg-destructive", label: "Problem" },
  warn: { icon: CircleAlert, box: "bg-accent", mark: "bg-primary", label: "Warning" },
  good: { icon: Check, box: "bg-muted", mark: "bg-chart-2", label: "Good" },
  info: { icon: Info, box: "bg-muted", mark: "bg-muted-foreground", label: "Note" },
};

const ORDER: CheckLevel[] = ["bad", "warn", "good", "info"];

export function Checklist({ analysis, limit }: { analysis: Analysis; limit?: number }) {
  const checks = [...analysis.checks].sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level));
  const shown = limit ? checks.slice(0, limit) : checks;
  return (
    <Panel title="Checklist">
      <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 md:grid-cols-2">
        {shown.map((c) => {
          const l = LEVEL[c.level];
          const Icon = l.icon;
          return (
            <li key={c.text} className={cn("flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm leading-normal", l.box)}>
              <span className={cn("mt-px grid size-4.5 flex-none place-items-center rounded-full text-background", l.mark)}>
                <Icon className="size-3" strokeWidth={3} aria-label={l.label} />
              </span>
              <span className="min-w-0">{c.text}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
