import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "../shared/bundle";
import type { RoadNode, Roadmap } from "../shared/runs";
import { t } from "./i18n";
import { nameOf } from "./store";
import { PersonChip } from "./ui";

const rowH = 56;
const laneW = 22;
const pad = 14;
const inks = ["var(--red-tx)", "var(--blue-tx)", "var(--slip)", "var(--plan)", "#9fd39a", "#e7b35a"];

type Placed = RoadNode & { row: number; lane: number };

function place(nodes: RoadNode[]): { placed: Placed[]; lanes: number } {
  const index = new Map(nodes.map((node, row) => [node.key, row]));
  const children = new Map<string, number[]>();
  nodes.forEach((node, row) => {
    for (const parent of node.after) children.set(parent, [...(children.get(parent) ?? []), row]);
  });
  const holders: (string | null)[] = [];
  const laneOf = new Map<string, number>();
  const placed = nodes.map((node, row) => {
    for (let lane = 0; lane < holders.length; lane++) {
      const holder = holders[lane];
      if (holder && !(children.get(holder) ?? []).some((child) => child >= row)) holders[lane] = null;
    }
    const parentLanes = node.after
      .filter((parent) => (index.get(parent) ?? row) < row)
      .map((parent) => laneOf.get(parent)!)
      .filter((lane) => holders[lane] !== null && node.after.includes(holders[lane]!));
    const free = holders.findIndex((holder, at) => holder === null && (!node.optional || at > 0));
    let lane = parentLanes.length && !node.optional ? Math.min(...parentLanes) : free;
    if (lane < 0) lane = holders.length;
    holders[lane] = node.key;
    laneOf.set(node.key, lane);
    return { ...node, row, lane };
  });
  return { placed, lanes: Math.max(1, ...placed.map((node) => node.lane + 1)) };
}

const x = (lane: number) => pad + lane * laneW;
const y = (row: number) => rowH / 2 + row * rowH;

function edgePath(from: Placed, to: Placed): string {
  const [x1, y1, x2, y2] = [x(from.lane), y(from.row), x(to.lane), y(to.row)];
  if (x1 === x2) return `M${x1} ${y1}V${y2}`;
  if (to.optional) {
    const out = y1 + rowH * 0.6;
    return `M${x1} ${y1}C${x1} ${y1 + rowH * 0.35} ${x2} ${y1 + rowH * 0.25} ${x2} ${out}V${y2}`;
  }
  const bend = y2 - rowH * 0.6;
  return `M${x1} ${y1}V${bend}C${x1} ${bend + rowH * 0.35} ${x2} ${bend + rowH * 0.25} ${x2} ${y2}`;
}

function Stamp({ node, fresh }: { node: Placed; fresh: boolean }) {
  const ink = inks[node.lane % inks.length]!;
  const cx = x(node.lane);
  const cy = y(node.row);
  if (!node.done)
    return node.optional ? (
      <rect x={cx - 6} y={cy - 6} width={12} height={12} transform={`rotate(45 ${cx} ${cy})`} className="rm-ghost" />
    ) : (
      <circle cx={cx} cy={cy} r={7} className="rm-ghost" />
    );
  return (
    <g className={fresh ? "rm-stamp rm-fresh" : "rm-stamp"} style={{ color: ink }}>
      {fresh && <circle cx={cx} cy={cy} r={9} className="rm-ring" />}
      {node.optional ? (
        <rect x={cx - 7} y={cy - 7} width={14} height={14} rx={2} transform={`rotate(45 ${cx} ${cy})`} className="rm-dot" />
      ) : (
        <circle cx={cx} cy={cy} r={9} className="rm-dot" />
      )}
      <path d={`M${cx - 4} ${cy}l3 3 5-6`} className="rm-tick" />
    </g>
  );
}

function clock(at: string): string {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function RoadmapGraph({ map, fresh, language, compact }: { map: Roadmap; fresh: Set<string>; language: Language; compact?: boolean }) {
  const { placed, lanes } = useMemo(() => place(map.nodes), [map]);
  const byKey = new Map(placed.map((node) => [node.key, node]));
  const width = pad * 2 + (lanes - 1) * laneW;
  const height = placed.length * rowH;
  return (
    <div className={compact ? "rm rm-compact" : "rm"} lang={language}>
      <svg className="rm-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {placed.flatMap((node) =>
          node.after.flatMap((parent) => {
            const from = byKey.get(parent);
            if (!from) return [];
            const ink = inks[node.lane % inks.length]!;
            return [<path key={`${parent}-${node.key}`} d={edgePath(from, node)} className={node.done ? (node.optional ? "rm-edge rm-side" : "rm-edge") : "rm-edge rm-edge-ghost"} style={{ stroke: ink }} />];
          }),
        )}
        {placed.map((node) => (
          <Stamp key={node.key} node={node} fresh={fresh.has(node.key)} />
        ))}
      </svg>
      <ol className="rm-rows" style={{ paddingLeft: width + 8 }}>
        {placed.map((node) => (
          <li key={node.key} className={[node.done ? "" : "rm-later", fresh.has(node.key) ? "rm-new" : ""].filter(Boolean).join(" ") || undefined} style={{ height: rowH }}>
            {node.label ? <span className="rm-label">{node.label}</span> : <span className="rm-redacted" aria-label={t.notNamedYet} />}
            <span className="rm-meta">
              {node.done ? (
                <>
                  {node.by && <PersonChip person={node.by} you={false} small />}
                  {node.by && <span className="rm-by">{nameOf(node.by)}</span>}
                  {node.at && <time className="rm-at">{clock(node.at)}</time>}
                  {node.earlier && <span className="rm-tag">{t.doneEarlier}</span>}
                  {node.optional && <span className="rm-tag">{t.sideTrail}</span>}
                </>
              ) : (
                <span className="rm-tag">{node.optional ? t.sideTrailMissed : t.notDone}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function useFresh(map: Roadmap | null): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!map) return;
    const keys = map.nodes.filter((node) => node.done).map((node) => node.key);
    if (seen.current === null) {
      seen.current = new Set(keys);
      return;
    }
    const added = keys.filter((key) => !seen.current!.has(key));
    for (const key of added) seen.current.add(key);
    if (!added.length) return;
    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), 6000);
    return () => clearTimeout(timer);
  }, [map]);
  return fresh;
}

export function RoadmapPanel({ map, fresh, language, onOpen }: { map: Roadmap | null; fresh: Set<string>; language: Language; onOpen: () => void }) {
  const tail = map ? { ...map, nodes: map.nodes.filter((node) => node.done).slice(-4) } : null;
  return (
    <section className="rmp" aria-label={t.roadmap}>
      <div className="rmp-h">
        <span className="lab">{t.roadmap}</span>
        {map?.beaten && <span className="rm-beaten">{t.beaten}</span>}
      </div>
      {tail && tail.nodes.length ? (
        <RoadmapGraph map={{ ...tail, nodes: tail.nodes.map((node) => ({ ...node, after: node.after.filter((key) => tail.nodes.some((other) => other.key === key)) })) }} fresh={fresh} language={language} compact />
      ) : (
        <p className="state rmp-empty">{t.roadmapEmpty}</p>
      )}
      <button type="button" className="b b-ghost rmp-open" onClick={onOpen}>
        {t.seeRoadmap}
      </button>
    </section>
  );
}

export function RoadmapColumn({ map, fresh, language }: { map: Roadmap | null; fresh: Set<string>; language: Language }) {
  const body = useRef<HTMLDivElement>(null);
  const count = map?.nodes.length ?? 0;
  useEffect(() => {
    const element = body.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [count]);
  return (
    <aside className="road-col" aria-label={t.roadmap}>
      <div className="road-col-h">
        <span className="lab">{t.roadmap}</span>
        <h2 className="cond">{map?.beaten ? t.roadmapBeaten : t.roadmapTitle}</h2>
      </div>
      <div className="road-col-b" ref={body}>{map && map.nodes.length ? <RoadmapGraph map={map} fresh={fresh} language={language} /> : <p className="state rmp-empty">{t.roadmapEmpty}</p>}</div>
    </aside>
  );
}

export function RoadmapSheet({ map, fresh, language, onClose }: { map: Roadmap | null; fresh: Set<string>; language: Language; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="rms" aria-label={t.roadmap} onClose={onClose} onClick={(event) => event.target === dialog.current && onClose()}>
      <div className="rms-in">
        <div className="rms-h">
          <div>
            <span className="lab">{t.roadmap}</span>
            <h2 className="cond">{map?.beaten ? t.roadmapBeaten : t.roadmapTitle}</h2>
          </div>
          <button type="button" className="b b-ghost" onClick={onClose}>
            {t.close}
          </button>
        </div>
        <div className="rms-body">{map && map.nodes.length ? <RoadmapGraph map={map} fresh={fresh} language={language} /> : <p className="state">{t.roadmapEmpty}</p>}</div>
      </div>
    </dialog>
  );
}
