import type { PublishedMap } from "../shared/bundle";

const wards = [28, 46, 64, 82, 100];

function Platform() {
  const sleepers = Array.from({ length: 10 }, (_, index) => 14 + index * 12);
  return (
    <>
      <rect x="10" y="30" width="96" height="14" />
      <path d="M6 56H134M6 64H134" />
      <path d={sleepers.map((x) => `M${x} 52v16`).join("")} strokeWidth=".8" />
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
      <path d={wards.map((x) => `M${x} 10v34M${x} 54v32`).join("")} strokeWidth=".9" />
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

export function MapPlan({ art, name }: { art: PublishedMap["art"]; name: string }) {
  const Plan = plans[art];
  return (
    <svg className="plan" viewBox="0 0 140 96" fill="none" strokeWidth="1.4" role="img" aria-label={name}>
      <Plan />
    </svg>
  );
}
