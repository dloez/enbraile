import { useEffect, useId, useRef, useState } from "react";
import type { PublishedMap } from "../shared/bundle";
import { imagePath } from "../shared/image";
import type { ShownZone } from "../shared/runs";

const wards = [28, 46, 64, 82, 100];

function Platform() {
  const sleepers = Array.from({ length: 10 }, (_, index) => 14 + index * 12);
  return (
    <>
      <rect x="10" y="30" width="96" height="14" />
      <path d="M6 56H134M6 64H134" />
      <path d={sleepers.map((x) => `M${x} 52v16`).join("")} className="thin" />
      <rect x="18" y="8" width="34" height="22" />
      <rect x="60" y="12" width="22" height="18" />
      <path d="M106 30h22v14" strokeDasharray="3 3" />
      <rect x="30" y="74" width="44" height="14" />
    </>
  );
}

function Wards() {
  return (
    <>
      <rect x="10" y="10" width="120" height="76" />
      <path d="M10 44H130M10 54H130" />
      <path d={wards.map((x) => `M${x} 10v34M${x} 54v32`).join("")} className="thin" />
      <circle cx="116" cy="70" r="8" />
    </>
  );
}

function Works() {
  return (
    <>
      <rect x="10" y="22" width="76" height="62" />
      <path d="M10 52H86" strokeDasharray="4 3" />
      <circle cx="108" cy="32" r="12" />
      <circle cx="108" cy="32" r="5" />
      <rect x="94" y="56" width="34" height="28" />
      <path d="M86 70h8M30 22V10h20v12" />
    </>
  );
}

const plans = { teal: Platform, rust: Wards, furnace: Works };

export function MapPlan({ art, label }: { art: PublishedMap["art"]; label?: string }) {
  const Plan = plans[art];
  return (
    <svg className="plan-svg" viewBox="0 0 140 96" fill="none" stroke="currentColor" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Plan />
    </svg>
  );
}

type Shown = Pick<PublishedMap, "art" | "image">;

export function MapArt({ map, label, className, large }: { map: Shown; label?: string; className: string; large?: boolean }) {
  const Tag = large ? "div" : "span";
  const image = useRef<HTMLImageElement>(null);
  const digest = map.image?.digest;
  const [seen, setSeen] = useState<{ digest: string | undefined; state: "loading" | "shown" | "failed" }>({ digest, state: "loading" });
  const state = seen.digest === digest ? seen.state : "loading";
  const setState = (next: "shown" | "failed") => setSeen({ digest, state: next });
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setSeen({ digest, state: "shown" });
  }, [digest]);
  if (!map.image || state === "failed")
    return (
      <Tag className={className}>
        <MapPlan art={map.art} label={label} />
      </Tag>
    );
  return (
    <Tag className={`${className} art${state === "loading" ? " skeleton" : ""}`}>
      <img
        ref={image}
        src={imagePath(map.image.digest)}
        width={map.image.width}
        height={map.image.height}
        alt={label ?? ""}
        decoding="async"
        onLoad={() => setState("shown")}
        onError={() => setState("failed")}
      />
    </Tag>
  );
}

const planBox = { width: 140, height: 96 };

const crop = { share: 0.4, aspect: 4 / 3, fill: 1 / 3, least: 0.025 };

type Box = { x: number; y: number; w: number; h: number };

function around(cx: number, cy: number, rx: number, ry: number, width: number, height: number): Box {
  const wanted = Math.max(crop.share * width, (2 * rx) / crop.fill, ((2 * ry) / crop.fill) * crop.aspect);
  const w = Math.min(wanted, width, height * crop.aspect);
  const h = w / crop.aspect;
  return { x: Math.min(Math.max(cx - w / 2, 0), width - w), y: Math.min(Math.max(cy - h / 2, 0), height - h), w, h };
}

export function SurveyZone({ zone, art, words }: { zone: ShownZone; art: PublishedMap["art"]; words: { zone: string; whole: string; near: string } }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [whole, setWhole] = useState(false);
  const { width, height } = zone.survey ?? planBox;
  const cx = zone.x * width;
  const cy = zone.y * height;
  const near = around(cx, cy, zone.rx * width, zone.ry * height, width, height);
  const view = whole ? { x: 0, y: 0, w: width, h: height } : near;
  const unit = view.w / 600;
  const hatch = 7 * unit;
  const cell = 20 * unit;
  const Plan = plans[art];
  const least = crop.least * near.w;
  const shape = { cx, cy, rx: Math.max(zone.rx * width, least), ry: Math.max(zone.ry * height, least) };
  return (
    <button type="button" className={`survey${whole ? " survey-whole" : ""}`} aria-pressed={whole} aria-label={`${words.zone}. ${whole ? words.near : words.whole}`} onClick={() => setWhole(!whole)}>
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} aria-hidden="true">
        <defs>
          <pattern id={`${id}h`} width={hatch} height={hatch} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d={`M0 0V${hatch}`} className="survey-hatch" strokeWidth={1.6 * unit} />
          </pattern>
          <pattern id={`${id}g`} width={cell} height={cell} patternUnits="userSpaceOnUse">
            <path d={`M${cell} 0H0V${cell}`} fill="none" className="survey-grid" strokeOpacity={0.2} strokeWidth={unit} />
          </pattern>
        </defs>
        {zone.survey ? (
          <image href={imagePath(zone.survey.digest)} width={width} height={height} />
        ) : (
          <>
            <rect width={width} height={height} fill={`url(#${id}g)`} />
            <g className="survey-plan" fill="none">
              <Plan />
            </g>
          </>
        )}
        <ellipse {...shape} fill={`url(#${id}h)`} fillOpacity={0.55} />
        <ellipse {...shape} className="zone-halo" />
        <ellipse {...shape} className="zone-edge" />
        <ellipse {...shape} className="zone-ring" />
      </svg>
      <span className="survey-flip" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
          <path d={whole ? "M2 6h4V2M14 10h-4v4M6 6 2 2M10 10l4 4" : "M2 6V2h4M14 10v4h-4M2 2l4 4M14 14l-4-4"} />
        </svg>
      </span>
    </button>
  );
}
