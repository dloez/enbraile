import { useEffect, useRef, useState } from "react";

type Tone = { hue: number; saturation: number } | null;

const SAMPLE = 32;
const BINS = 24;
const tones = new Map<string, Tone>();

async function sample(src: string): Promise<Tone> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.referrerPolicy = "no-referrer";
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, SAMPLE, SAMPLE);
  const { data } = context.getImageData(0, 0, SAMPLE, SAMPLE);
  const weight = new Float64Array(BINS);
  const saturation = new Float64Array(BINS);
  const x = new Float64Array(BINS);
  const y = new Float64Array(BINS);
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index]! / 255;
    const g = data[index + 1]! / 255;
    const b = data[index + 2]! / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const light = (max + min) / 2;
    if (chroma < 0.12 || light < 0.1 || light > 0.94) continue;
    const hue = max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    const degrees = hue * 60;
    const bin = Math.min(BINS - 1, Math.floor(degrees / (360 / BINS)));
    const w = chroma * chroma;
    weight[bin]! += w;
    saturation[bin]! += (chroma / (1 - Math.abs(2 * light - 1))) * w;
    x[bin]! += Math.cos((degrees * Math.PI) / 180) * w;
    y[bin]! += Math.sin((degrees * Math.PI) / 180) * w;
  }
  let best = 0;
  for (let bin = 1; bin < BINS; bin++) if (weight[bin]! > weight[best]!) best = bin;
  if (weight[best]! < 4) return null;
  const hue = ((Math.atan2(y[best]!, x[best]!) * 180) / Math.PI + 360) % 360;
  return { hue, saturation: saturation[best]! / weight[best]! };
}

function apply(tone: Tone): void {
  const root = document.documentElement.style;
  if (!tone) {
    root.removeProperty("--accent");
    root.removeProperty("--accent-ink");
    return;
  }
  const hue = Math.round(tone.hue);
  const saturation = Math.round(Math.min(88, Math.max(58, tone.saturation * 100)));
  const light = hue > 40 && hue < 200 ? 58 : 66;
  root.setProperty("--accent", `hsl(${hue} ${saturation}% ${light}%)`);
  root.setProperty("--accent-ink", `hsl(${hue} 70% 9%)`);
}

export function useAccent(src: string | null): void {
  useEffect(() => {
    if (!src) return apply(null);
    if (tones.has(src)) return apply(tones.get(src)!);
    let current = true;
    sample(src).then((tone) => {
      tones.set(src, tone);
      if (current) apply(tone);
    }, () => {
      tones.set(src, null);
      if (current) apply(null);
    });
    return () => {
      current = false;
    };
  }, [src]);
}

export function Ambient({ src, paused }: { src: string | null; paused: boolean }) {
  const [layers, setLayers] = useState<{ src: string; key: number }[]>([]);
  const counter = useRef(0);
  useEffect(() => {
    if (!src) return setLayers([]);
    setLayers((previous) => (previous.at(-1)?.src === src ? previous : [...previous.slice(-1), { src, key: ++counter.current }]));
  }, [src]);
  return (
    <div className="ambient" aria-hidden="true" data-paused={paused}>
      {layers.map((layer) => <img key={layer.key} src={layer.src} alt="" referrerPolicy="no-referrer" />)}
    </div>
  );
}
