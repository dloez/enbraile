import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition, type LayoutOptions, type StylesheetJson } from "cytoscape";
import { typesIn } from "@/analysis/dex";
import type { Member } from "@/analysis/member";
import type { Analysis, SynergyEdge } from "@/analysis/team";
import { typeIconSvg } from "@/lib/type-icons";
import { TypeDot } from "@/components/marks";
import { buttonClass, SelectField, Toggle } from "@/components/controls";
import { spriteOf } from "@/analysis/sprite";

export type Layer = "synergy" | "weak" | "resist" | "offense";

const LAYERS: readonly { key: Layer; label: string; swatch: string }[] = [
  { key: "synergy", label: "Synergy", swatch: "h-0.75 w-3.5 rounded-sm bg-primary" },
  { key: "weak", label: "Weaknesses", swatch: "h-0.75 w-3.5 rounded-sm bg-destructive" },
  { key: "resist", label: "Resistances", swatch: "w-3.5 border-t-2 border-dashed border-chart-2" },
  { key: "offense", label: "Coverage", swatch: "w-3.5 border-t-2 border-dotted border-chart-3" },
];

type LayoutName = "concentric" | "cose" | "circle" | "breadthfirst";

const LAYOUTS: readonly { value: LayoutName; label: string }[] = [
  { value: "concentric", label: "Concentric" },
  { value: "cose", label: "Force" },
  { value: "circle", label: "Circle" },
  { value: "breadthfirst", label: "Hierarchy" },
];

type Selection =
  | { kind: "mon"; index: number }
  | { kind: "type"; type: string }
  | { kind: "synergy"; from: number; to: number }
  | null;

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function typeColour(type: string): string {
  return css(`--type-${type.toLowerCase()}`) || css("--muted-foreground");
}

function typeIconUrl(type: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(typeIconSvg(type, css("--foreground")))}`;
}

function layoutOptions(name: LayoutName, animate: boolean): LayoutOptions {
  if (name === "concentric") {
    return {
      name,
      concentric: (n) => (n.data("kind") === "mon" ? 2 : 1),
      levelWidth: () => 1,
      minNodeSpacing: 28,
      animate,
      animationDuration: 400,
      padding: 30,
    };
  }
  if (name === "cose") {
    return {
      name,
      animate,
      animationDuration: 600,
      nodeRepulsion: () => 9000,
      idealEdgeLength: () => 110,
      edgeElasticity: (e) => (e.data("kind") === "synergy" ? 60 : 160),
      padding: 30,
      randomize: false,
    };
  }
  return { name, animate, animationDuration: 400, padding: 30 };
}

function elements(team: readonly Member[], a: Analysis, layers: Record<Layer, boolean>, minSynergy: number): ElementDefinition[] {
  const els: ElementDefinition[] = team.map((m, i) => ({
    group: "nodes",
    data: { id: `m${i}`, kind: "mon", label: m.set.species, img: spriteOf(m), ring: typeColour(m.types[0]) },
    classes: "mon",
  }));
  if (layers.weak || layers.resist || layers.offense) {
    for (const t of typesIn(a.gen)) {
      const d = a.tDef.find((x) => x.type === t);
      const o = a.tOff.find((x) => x.type === t);
      const cls = ["type"];
      if (layers.weak && d && d.unresisted && d.weak > 0) cls.push("danger");
      if (layers.offense && o?.uncovered) cls.push("gap");
      els.push({ group: "nodes", data: { id: `t-${t}`, kind: "type", type: t, label: t, color: typeColour(t), icon: typeIconUrl(t) }, classes: cls.join(" ") });
    }
  }
  if (layers.synergy) {
    for (const e of a.edges.filter((x) => x.score >= minSynergy)) {
      els.push({
        group: "edges",
        data: {
          id: `s${e.from}-${e.to}`,
          source: `m${e.from}`,
          target: `m${e.to}`,
          kind: "synergy",
          from: e.from,
          to: e.to,
          label: `${e.types.join(" · ")} (${e.score.toFixed(1)})`,
          w: e.score,
        },
        classes: e.mutual ? "synergy mutual" : "synergy",
      });
    }
  }
  team.forEach((_, i) => {
    for (const t of typesIn(a.gen)) {
      const mult = a.members[i].def[t];
      if (layers.weak && mult > 1)
        els.push({
          group: "edges",
          data: { id: `w${t}-${i}`, source: `t-${t}`, target: `m${i}`, kind: "weak", label: `${mult}×` },
          classes: mult >= 4 ? "weak quad" : "weak",
        });
      if (layers.resist && mult < 1)
        els.push({
          group: "edges",
          data: { id: `r${t}-${i}`, source: `t-${t}`, target: `m${i}`, kind: "resist", label: mult === 0 ? "immune" : `${mult}×` },
          classes: mult === 0 ? "resist immune" : "resist",
        });
      const o = a.offs[i][t];
      if (layers.offense && o.mult !== null && o.mult > 1 && o.move) {
        const O = a.tOff.find((x) => x.type === t)?.os[i].O ?? 0;
        els.push({
          group: "edges",
          data: {
            id: `o${i}-${t}`,
            source: `m${i}`,
            target: `t-${t}`,
            kind: "offense",
            label: `${o.move.name} (${O.toFixed(2)})`,
            color: typeColour(o.move.type),
            O,
          },
          classes: o.stab ? "offense stab" : "offense",
        });
      }
    }
  });
  return els;
}

const SPRITE = {
  "background-image": "data(img)",
  "background-image-crossorigin": "null",
  "background-fit": "contain",
  "background-width": "90%",
  "background-height": "90%",
};

function style(): StylesheetJson {
  const ink = css("--foreground");
  const ink2 = css("--muted-foreground");
  const ground = css("--muted");
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        color: ink,
        "font-size": 11,
        "font-family": getComputedStyle(document.body).fontFamily,
        "text-valign": "bottom",
        "text-margin-y": 5,
        "text-outline-color": ground,
        "text-outline-width": 2,
      },
    },
    {
      selector: "node.mon",
      style: {
        width: 78,
        height: 78,
        "background-color": css("--cell"),
        ...SPRITE,
        "border-width": 4,
        "border-color": "data(ring)",
        "font-size": 13,
        "font-weight": 600,
      },
    },
    {
      selector: "node.type",
      style: {
        width: 34,
        height: 34,
        "background-color": "data(color)",
        "background-image": "data(icon)",
        "background-width": "60%",
        "background-height": "60%",
        "border-width": 2,
        "border-color": ground,
        "font-size": 10,
        color: ink2,
      },
    },
    {
      selector: "node.type.danger",
      style: { "border-color": css("--destructive"), "border-width": 4, "border-style": "double", color: css("--destructive"), "font-weight": 700 },
    },
    { selector: "node.type.gap", style: { shape: "diamond", opacity: 0.75 } },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.9,
        "font-size": 9,
        color: ink2,
        "text-background-color": ground,
        "text-background-opacity": 0.85,
        "text-background-padding": "2",
        "text-rotation": "autorotate",
        label: "",
      },
    },
    {
      selector: "edge.synergy",
      style: {
        "line-color": css("--chart-2"),
        "target-arrow-color": css("--chart-2"),
        width: "mapData(w, 0, 12, 1, 8)",
        opacity: 0.85,
      },
    },
    { selector: "edge.synergy.mutual", style: { "line-color": css("--primary"), "target-arrow-color": css("--primary") } },
    {
      selector: "edge.weak",
      style: { "line-color": css("--destructive"), "target-arrow-color": css("--destructive"), width: 1.6, opacity: 0.7 },
    },
    { selector: "edge.weak.quad", style: { width: 4 } },
    {
      selector: "edge.resist",
      style: { "line-color": css("--chart-2"), "target-arrow-color": css("--chart-2"), "line-style": "dashed", width: 1.4, opacity: 0.6 },
    },
    { selector: "edge.resist.immune", style: { "line-style": "solid", width: 3 } },
    {
      selector: "edge.offense",
      style: { "line-color": "data(color)", "target-arrow-color": "data(color)", width: "mapData(O, 0, 4, 1, 7)", "line-style": "dotted", opacity: 0.8 },
    },
    { selector: "edge.offense.stab", style: { "line-style": "solid" } },
    { selector: "edge.hl", style: { label: "data(label)" } },
    { selector: ".faded", style: { opacity: 0.08, "text-opacity": 0 } },
    { selector: "node.hl", style: { "border-color": css("--primary"), "border-width": 5 } },
  ];
}

function Detail({ team, analysis, selection }: { team: readonly Member[]; analysis: Analysis; selection: Selection }) {
  if (!selection) {
    return <p className="m-0 text-sm text-muted-foreground">Hover or tap a Pokémon, a type or a link.</p>;
  }
  if (selection.kind === "synergy") {
    const there = analysis.edges.find((e) => e.from === selection.from && e.to === selection.to);
    const back = analysis.edges.find((e) => e.from === selection.to && e.to === selection.from);
    const a = team[selection.from];
    const b = team[selection.to];
    const side = (e: SynergyEdge, cover: Member, covered: Member) => (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          {cover.set.species} covers {covered.set.species}
        </span>
        {e.types.map((t) => (
          <div key={t} className="flex items-center justify-between rounded-lg border bg-muted px-2.5 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <TypeDot type={t} />
              {t}
            </span>
            <span className="tabular-nums text-xs">
              ×{analysis.members[e.to].def[t]} · D {e.perType[t].toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2">
          <img src={spriteOf(a)} alt="" className="size-12 [image-rendering:pixelated]" />
          <span className="tabular-nums text-lg text-primary">{back ? "⇄" : "→"}</span>
          <img src={spriteOf(b)} alt="" className="size-12 [image-rendering:pixelated]" />
        </div>
        <div>
          <div className="font-heading text-2xl">
            {a.set.species} {back ? "⇄" : "→"} {b.set.species}
          </div>
          <div className="text-xs text-muted-foreground">
            {back ? "Mutual core" : "One-way cover"} · weighted synergy{" "}
            <span className="tabular-nums text-foreground">{((there?.score ?? 0) + (back?.score ?? 0)).toFixed(2)}</span>
          </div>
        </div>
        {there && side(there, b, a)}
        {back && side(back, a, b)}
        <p className="m-0 text-xs leading-normal text-muted-foreground">D 1.00 = an average Pokémon of the pool taking a neutral hit.</p>
      </div>
    );
  }
  if (selection.kind === "type") {
    const t = selection.type;
    const d = analysis.tDef.find((x) => x.type === t);
    const o = analysis.tOff.find((x) => x.type === t);
    const list = (pred: (i: number) => boolean) =>
      team.filter((_, i) => pred(i)).map((m) => m.set.species).join(", ") || "—";
    return (
      <div className="flex flex-col gap-2.5 text-sm">
        <div className="inline-flex items-center gap-2 font-heading text-2xl">
          <TypeDot type={t} className="size-5" />
          {t}
        </div>
        <div>
          <span className="text-muted-foreground">Weak: </span>
          {list((i) => analysis.members[i].def[t] > 1)}
        </div>
        <div>
          <span className="text-muted-foreground">Resist or immune: </span>
          {list((i) => analysis.members[i].def[t] < 1)}
        </div>
        {d && (
          <div>
            <span className="text-muted-foreground">Best switch-in: </span>
            {team[d.best.idx].set.species} <span className="tabular-nums">D {d.best.D.toFixed(2)}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Hit super-effectively by: </span>
          {list((i) => (analysis.offs[i][t].mult ?? 0) > 1)}
        </div>
        {o?.bestO.move && (
          <div>
            <span className="text-muted-foreground">Best hit: </span>
            {team[o.bestO.idx].set.species}'s {o.bestO.move.name} <span className="tabular-nums">O {o.bestO.O.toFixed(2)}</span>
          </div>
        )}
      </div>
    );
  }
  const m = team[selection.index];
  const ma = analysis.members[selection.index];
  const types = typesIn(analysis.gen);
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <div className="flex items-center gap-2.5">
        <img src={spriteOf(m)} alt="" className="size-14 [image-rendering:pixelated]" />
        <div className="flex flex-col">
          <span className="font-heading text-2xl">{m.display}</span>
          <span className="text-xs text-muted-foreground">{ma.roles.join(" · ")}</span>
        </div>
      </div>
      <div>
        <span className="text-muted-foreground">Weak to: </span>
        {types.filter((t) => ma.def[t] > 1).map((t) => `${t} ×${ma.def[t]}`).join(", ") || "—"}
      </div>
      <div>
        <span className="text-muted-foreground">Covered by: </span>
        {analysis.edges
          .filter((e) => e.from === selection.index)
          .map((e) => team[e.to].set.species)
          .join(", ") || "nobody"}
      </div>
      <div>
        <span className="text-muted-foreground">Covers: </span>
        {analysis.edges
          .filter((e) => e.to === selection.index)
          .map((e) => team[e.from].set.species)
          .join(", ") || "nobody"}
      </div>
    </div>
  );
}

export function TeamGraph({ team, analysis, height = 600 }: { team: readonly Member[]; analysis: Analysis; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const positions = useRef<{ key: string; at: Map<string, { x: number; y: number }> } | null>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ synergy: true, weak: false, resist: false, offense: false });
  const [layout, setLayout] = useState<LayoutName>("concentric");
  const layoutRef = useRef<LayoutName>("concentric");
  const [minSynergy, setMinSynergy] = useState(0);
  const [labels, setLabels] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const teamKey = team.map((m) => m.id).join("|");
  const els = useMemo(() => elements(team, analysis, layers, minSynergy), [team, analysis, layers, minSynergy]);

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: els,
      style: style(),
      minZoom: 0.2,
      maxZoom: 3,
    });
    cyRef.current = cy;
    if (labels) cy.edges().addClass("hl");
    const known = positions.current?.key === teamKey ? positions.current.at : null;
    if (known && cy.nodes().toArray().every((n) => known.has(n.id()))) {
      cy.nodes().forEach((n) => {
        const p = known.get(n.id());
        if (p) n.position(p);
      });
      cy.fit(undefined, 30);
    } else {
      cy.layout(layoutOptions(layoutRef.current, false)).run();
    }
    let pinned = false;
    const clear = () => {
      cy.elements().removeClass("faded");
      cy.nodes().removeClass("hl");
      if (!labels) cy.edges().removeClass("hl");
    };
    const focus = (ele: cytoscape.SingularElementArgument) => {
      clear();
      const hood = ele.isNode() ? ele.closedNeighborhood() : ele.union(ele.connectedNodes());
      cy.elements().not(hood).addClass("faded");
      hood.edges().addClass("hl");
      if (ele.isNode()) ele.addClass("hl");
    };
    const select = (ele: cytoscape.SingularElementArgument) => {
      const d = ele.data();
      if (ele.isNode()) setSelection(d.kind === "mon" ? { kind: "mon", index: Number(String(d.id).slice(1)) } : { kind: "type", type: d.type });
      else if (d.kind === "synergy") setSelection({ kind: "synergy", from: d.from, to: d.to });
    };
    cy.on("mouseover", "node, edge", (e) => {
      if (!pinned) {
        focus(e.target);
        select(e.target);
      }
    });
    cy.on("mouseout", "node, edge", () => {
      if (!pinned) clear();
    });
    cy.on("tap", "node, edge", (e) => {
      pinned = true;
      focus(e.target);
      select(e.target);
    });
    cy.on("tap", (e) => {
      if (e.target === cy) {
        pinned = false;
        clear();
        setSelection(null);
      }
    });
    return () => {
      positions.current = { key: teamKey, at: new Map(cy.nodes().map((n) => [n.id(), { ...n.position() }])) };
      cy.destroy();
      cyRef.current = null;
    };
  }, [els, labels, teamKey]);

  const relayout = (name: LayoutName) => {
    cyRef.current?.layout(layoutOptions(name, true)).run();
  };

  const exportPng = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const mons = cy.nodes(".mon");
    mons.style("background-image", "none");
    const href = cy.png({ full: true, scale: 2, bg: css("--muted") });
    mons.removeStyle("background-image");
    const a = document.createElement("a");
    a.href = href;
    a.download = "team-graph.png";
    a.click();
  };

  return (
    <section aria-label="Graph" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border-3 bg-card">
      <div className="flex flex-wrap items-center gap-2.5 border-b px-3.5 py-3">
        <h3 className="m-0 mr-1.5 font-heading text-2xl">Graph</h3>
        {LAYERS.map((l) => (
          <Toggle key={l.key} pressed={layers[l.key]} onChange={(on) => setLayers({ ...layers, [l.key]: on })}>
            <span className={l.swatch} aria-hidden="true" />
            {l.label}
          </Toggle>
        ))}
        <div className="flex-1" />
        <SelectField
          label="Layout"
          size="sm"
          value={layout}
          options={LAYOUTS}
          onChange={(value) => {
            const name = value as LayoutName;
            layoutRef.current = name;
            setLayout(name);
            relayout(name);
          }}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Min synergy
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={minSynergy}
            onChange={(e) => setMinSynergy(Number(e.target.value))}
            className="w-24 accent-primary"
          />
          <span className="w-7 tabular-nums text-foreground">{minSynergy.toFixed(1)}</span>
        </label>
        <Toggle pressed={labels} onChange={setLabels}>
          Labels
        </Toggle>
        <button type="button" onClick={() => relayout(layout)} className={buttonClass}>
          Re-layout
        </button>
        <button type="button" onClick={() => cyRef.current?.fit(undefined, 30)} className={buttonClass}>
          Fit
        </button>
        <button type="button" onClick={exportPng} className={buttonClass} title="Sprites are left out of the image">
          PNG
        </button>
      </div>
      <div className="flex flex-wrap">
        <div className="relative min-w-0 flex-[999_1_560px] bg-muted" style={{ height }}>
          <div ref={container} className="h-full w-full" aria-label="Team graph" role="img" />
          <div className="pointer-events-none absolute bottom-3 left-3.5 flex flex-wrap gap-3.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-4.5 rounded-sm bg-primary" />
              Mutual core
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.75 w-4.5 rounded-sm bg-chart-2" />
              One-way cover
            </span>
            {layers.weak && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full border-3 border-double border-destructive" />
                Weakness nobody resists
              </span>
            )}
          </div>
        </div>
        <aside aria-label="Selection" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 border-l p-4">
          <Detail team={team} analysis={analysis} selection={selection} />
        </aside>
      </div>
    </section>
  );
}
