import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Scene } from "../../shared/series";

type Pixel = { x: number; y: number; w: number; h: number; c: string; a?: string };

type Paint = (x: number, y: number, w: number, h: number, colour: string, animation?: string) => void;

function rng(seed: number): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function blink(name: string, rand: () => number, low: number, high: number): string {
  return `scene-${name} ${(low + rand() * (high - low)).toFixed(2)}s steps(2) ${(rand() * 2).toFixed(2)}s infinite alternate`;
}

function bands(paint: Paint, width: number, rows: [number, number, string][]) {
  rows.forEach(([y, h, colour], i) => {
    paint(0, y, width, h, colour);
    if (i === 0) return;
    const above = rows[i - 1]![2];
    for (let x = i % 2; x < width; x += 2) paint(x, y, 1, 1, above);
  });
}

function night(width: number, height: number): Pixel[] {
  const pixels: Pixel[] = [];
  const paint: Paint = (x, y, w, h, c, a) => {
    if (w > 0 && h > 0) pixels.push({ x, y, w, h, c, a });
  };
  const k = height / 65;
  const at = (n: number) => Math.round(n * k);
  bands(paint, width, [
    [0, at(16), "night-sky-1"],
    [at(16), at(13), "night-sky-2"],
    [at(29), at(11), "night-sky-3"],
    [at(40), at(9), "night-sky-4"],
    [at(49), height - at(49), "night-sky-5"],
  ]);
  const rand = rng(7);
  const sky = at(44);
  for (let i = 0; i < width / 4; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * sky);
    const lit = rand() < 0.45;
    paint(x, y, 1, 1, lit ? "night-star" : "night-star-dim", lit ? blink("twinkle", rand, 0.6, 1.6) : undefined);
  }
  for (let i = 0; i < 6; i++) {
    const x = 6 + Math.floor(rand() * (width - 60));
    const y = 3 + Math.floor(rand() * (sky - 12));
    const a = blink("sparkle", rand, 0.9, 1.8);
    paint(x, y - 1, 1, 3, "night-sparkle", a);
    paint(x - 1, y, 3, 1, "night-sparkle", a);
    paint(x, y, 1, 1, "night-star", a);
  }
  const mx = width - 42;
  const my = at(16);
  for (let dy = -6; dy <= 6; dy++) {
    const w = Math.round(Math.sqrt(40 - dy * dy));
    paint(mx - w, my + dy, w * 2 + 1, 1, "night-moon");
  }
  paint(mx - 4, my - 4, 2, 2, "night-crater");
  paint(mx + 2, my + 1, 3, 2, "night-crater");
  paint(mx - 2, my + 4, 2, 1, "night-crater");
  const farBase = at(48);
  const nearBase = at(57);
  for (let x = 0; x < width; x++) {
    const top = farBase + Math.round(4 * Math.sin(x / 19) + 2 * Math.sin(x / 7));
    paint(x, top, 1, height - top, "night-far");
  }
  const near: number[] = [];
  for (let x = 0; x < width; x++) {
    const top = nearBase + Math.round(3 * Math.sin(x / 13 + 2) + 2 * Math.sin(x / 5));
    near.push(top);
    paint(x, top, 1, height - top, "night-near");
  }
  for (let x = 12; x < width - 6; x += 17 + Math.floor(rand() * 14)) {
    const y = near[x]! + 2;
    if (y >= height - 1) continue;
    const a = blink("glow", rand, 1.2, 2.6);
    paint(x, y, 1, 1, "night-window", a);
    if (rand() < 0.5) paint(x + 2, y, 1, 1, "night-lamp", a);
  }
  return pixels;
}

function tree(paint: Paint, tx: number, base: number) {
  [5, 7, 9, 9, 9, 9, 7, 5].forEach((w, i) => paint(tx - Math.floor(w / 2), base - 11 + i, w, 1, "route-tree"));
  paint(tx - 3, base - 10, 3, 1, "route-tree-hi");
  paint(tx - 4, base - 9, 3, 2, "route-tree-hi");
  paint(tx + 2, base - 5, 2, 2, "route-tree-shade");
  paint(tx - 1, base - 3, 2, 3, "route-trunk");
}

function route(width: number, height: number): Pixel[] {
  const pixels: Pixel[] = [];
  const paint: Paint = (x, y, w, h, c, a) => {
    if (w > 0 && h > 0) pixels.push({ x, y, w, h, c, a });
  };
  bands(paint, width, [
    [0, 10, "route-sky-1"],
    [10, 10, "route-sky-2"],
    [20, 8, "route-sky-3"],
    [28, 8, "route-sky-4"],
  ]);
  [
    [width - 190, 22, 30, 7],
    [width - 112, 26, 20, 9],
    [width - 52, 21, 24, 6],
  ].forEach(([x, y, w, d], i) => {
    const a = `scene-drift ${d}s steps(6) ${-i * 1.3}s infinite alternate`;
    paint(x! + 4, y!, w! - 10, 1, "route-cloud", a);
    paint(x! + 2, y! + 1, w! - 4, 2, "route-cloud", a);
    paint(x!, y! + 3, w!, 2, "route-cloud", a);
    paint(x! + 1, y! + 5, w! - 2, 1, "route-cloud-shade", a);
  });
  for (let x = 0; x < width; x++) {
    const top = 31 + Math.round(3 * Math.sin(x / 23) + 2 * Math.sin(x / 9 + 1));
    paint(x, top, 1, 38 - top, "route-hills");
  }
  paint(0, 38, width, height - 38, "route-grass");
  paint(0, 38, width, 1, "route-grass-hi");
  const rand = rng(5);
  for (let x = 4; x < width; x += 10) tree(paint, x + Math.floor(rand() * 4), 41);
  for (let x = 9; x < width; x += 13) tree(paint, x + Math.floor(rand() * 4), 46);
  paint(0, 48, width, 5, "route-path");
  paint(0, 48, width, 1, "route-path-hi");
  paint(0, 52, width, 1, "route-path-edge");
  for (let x = 7; x < width - 4; x += 15 + Math.floor(rand() * 12)) {
    const y = 53 + Math.floor(rand() * 2);
    const colour = rand() < 0.5 ? "route-flower" : "route-flower-red";
    paint(x, y, 1, 1, colour, blink("glow", rand, 1, 2.4));
    paint(x + 1, y, 1, 1, "route-flower-heart");
  }
  return pixels;
}

const DRAW: Record<Scene, (width: number, height: number) => Pixel[]> = { night, route };

export const SceneArt = memo(function SceneArt({
  scene,
  width,
  height,
  className,
}: {
  scene: Scene;
  width: number;
  height: number;
  className?: string;
}) {
  const pixels = useMemo(() => DRAW[scene](width, height), [scene, width, height]);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={cn("scene-art pointer-events-none absolute inset-0 block size-full", className)}
    >
      {pixels.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          style={{ fill: `var(--scene-${p.c})`, animation: p.a }}
        />
      ))}
    </svg>
  );
});

export const SCENE_LOOK: Record<Scene, { ground: string; title: string; chip: string; panel: string; panelSub: string; button: string }> = {
  night: {
    ground: "bg-scene-night-sky-1",
    title: "[text-shadow:0_5px_0_var(--scene-night-shadow)]",
    chip: "bg-scene-night-panel text-scene-night-sparkle",
    panel: "border-scene-night-panel-edge bg-scene-night-panel text-white",
    panelSub: "text-scene-night-panel-sub",
    button: "",
  },
  route: {
    ground: "bg-scene-route-sky-1",
    title:
      "[text-shadow:0_-4px_0_var(--ink),4px_0_0_var(--ink),0_4px_0_var(--ink),-4px_0_0_var(--ink),4px_4px_0_var(--ink),-4px_-4px_0_var(--ink),4px_-4px_0_var(--ink),-4px_4px_0_var(--ink),0_8px_0_var(--ink)]",
    chip: "bg-scene-route-panel text-ink",
    panel: "border-ink bg-scene-route-panel text-ink",
    panelSub: "text-scene-route-panel-sub",
    button: "bg-ink/10 text-ink hover:bg-ink/20",
  },
};
