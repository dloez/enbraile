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

export function SurveyZone({ zone, art, label }: { zone: ShownZone; art: PublishedMap["art"]; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { width, height } = zone.survey ?? planBox;
  const unit = width / 600;
  const hatch = 7 * unit;
  const cell = 20 * unit;
  const Plan = plans[art];
  const shape = { cx: zone.x * width, cy: zone.y * height, rx: zone.rx * width, ry: zone.ry * height };
  return (
    <div className="survey">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
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
    </div>
  );
}
