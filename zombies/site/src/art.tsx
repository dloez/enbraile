import type { PublishedMap } from "../shared/bundle";

const paint = (token: string) => ({ fill: `var(--${token})` });
const stroke = (token: string, width: number) => ({ stroke: `var(--${token})`, strokeWidth: width, fill: "none" });

function Sky({ id, top, floor }: { id: string; top: string; floor: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: `var(--${top})` }} />
          <stop offset="1" style={{ stopColor: `var(--${floor})` }} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${id})`} />
    </>
  );
}

function Teal({ id }: { id: string }) {
  const posts = Array.from({ length: 16 }, (_, index) => 8 + index * 26);
  return (
    <>
      <Sky id={id} top="teal-sky" floor="teal-floor" />
      <circle cx="318" cy="83" r="26" style={paint("teal-moon")} opacity="0.85" />
      <circle cx="318" cy="83" r="60" style={paint("teal-moon")} opacity="0.06" />
      <path d="M0 214 L60 214 L60 172 L74 172 L74 214 L150 214 L150 190 L240 190 L240 214 L400 214 L400 260 L0 260Z" style={paint("teal-shape")} />
      <path d="M150 190 L195 164 L240 190Z" style={paint("teal-shape")} />
      <g style={stroke("teal-shape", 3)}>
        <path d="M0 240 H400" />
        <path d="M0 250 H400" />
      </g>
      <g style={stroke("teal-shape", 5)}>
        {posts.map((x) => (
          <path key={x} d={`M${x} 236 V256`} />
        ))}
      </g>
      <rect x="0" y="220" width="400" height="18" style={paint("mint")} opacity="0.05" />
    </>
  );
}

function Rust({ id }: { id: string }) {
  const spikes = Array.from({ length: 18 }, (_, index) => 240 + index * 9);
  return (
    <>
      <Sky id={id} top="rust-sky" floor="rust-floor" />
      <path d="M90 220 V150 L150 120 L210 150 V220Z" style={paint("rust-shape")} />
      <rect x="138" y="90" width="24" height="40" style={paint("rust-shape")} />
      <path d="M134 90 L150 72 L166 90Z" style={paint("rust-shape")} />
      <rect x="110" y="160" width="9" height="13" style={paint("amber")} opacity="0.75" />
      <rect x="186" y="160" width="9" height="13" style={paint("amber")} opacity="0.18" />
      <rect x="110" y="186" width="9" height="13" style={paint("amber")} opacity="0.18" />
      <rect x="186" y="186" width="9" height="13" style={paint("amber")} opacity="0.55" />
      <path d="M0 220 Q100 208 200 220 T400 218 V260 H0Z" style={paint("rust-ground")} />
      <path d="M0 230 Q120 216 260 230 T400 232" style={stroke("blood", 1)} opacity="0.4" />
      <g style={paint("rust-ground")}>
        {spikes.map((x, index) => (
          <path key={x} d={`M${x} 222 l3 ${index % 2 ? -25 : -18} l3 ${index % 2 ? 25 : 18}z`} />
        ))}
      </g>
    </>
  );
}

function Furnace({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-glow`} cx="0.7" cy="0.85" r="0.6">
          <stop offset="0" style={{ stopColor: "var(--amber)", stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: "var(--amber)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <Sky id={id} top="furnace-sky" floor="furnace-floor" />
      <rect width="400" height="260" fill={`url(#${id}-glow)`} />
      <rect x="40" y="110" width="22" height="110" style={paint("furnace-shape")} />
      <rect x="78" y="136" width="18" height="84" style={paint("furnace-shape")} />
      <path d="M30 220 V180 H180 V220Z M180 220 V164 L230 140 L280 164 V220Z M280 220 V190 H400 V220Z" style={paint("furnace-shape")} />
      <rect x="0" y="220" width="400" height="40" style={paint("furnace-ground")} />
      <g style={paint("furnace-smoke")} opacity="0.12">
        <circle cx="51" cy="92" r="10" />
        <circle cx="58" cy="70" r="14" />
        <circle cx="66" cy="44" r="18" />
      </g>
    </>
  );
}

const scenes = { teal: Teal, rust: Rust, furnace: Furnace };

export function MapArt({ art, id }: { art: PublishedMap["art"]; id: string }) {
  const Scene = scenes[art];
  return (
    <svg viewBox="0 0 400 260" width="100%" height="260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <Scene id={`sky-${id}`} />
    </svg>
  );
}
