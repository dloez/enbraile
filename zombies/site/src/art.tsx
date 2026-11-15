import { useEffect, useRef, useState } from "react";
import type { PublishedMap } from "../shared/bundle";
import { imagePath } from "../shared/image";

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
