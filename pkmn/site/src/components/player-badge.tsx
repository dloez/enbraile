import { cn } from "@/lib/utils";

export const PLAYER_FILL = [
  "bg-player-1",
  "bg-player-2",
  "bg-player-3",
  "bg-player-4",
  "bg-player-5",
  "bg-player-6",
  "bg-player-7",
  "bg-player-8",
  "bg-player-9",
  "bg-player-10",
  "bg-player-11",
  "bg-player-12",
] as const;

export const PLAYER_RING = [
  "ring-player-1",
  "ring-player-2",
  "ring-player-3",
  "ring-player-4",
  "ring-player-5",
  "ring-player-6",
  "ring-player-7",
  "ring-player-8",
  "ring-player-9",
  "ring-player-10",
  "ring-player-11",
  "ring-player-12",
] as const;

const SIZES = {
  cell: "size-5.5 rounded-[5px] border-2 ring-2 text-base",
  xs: "size-8 rounded-[7px] ring-2 text-[1.375rem]",
  sm: "size-9 rounded-md ring-2 text-2xl",
  lg: "size-12.5 rounded-lg ring-3 text-3xl",
  xl: "size-16 rounded-xl border-4 ring-3 text-[2.75rem] sm:size-21 sm:rounded-[14px] sm:ring-4 sm:text-[3.5rem]",
  row: "size-8.5 rounded-lg ring-2 text-[1.375rem] sm:size-12.5 sm:ring-3 sm:text-3xl",
} as const;

export function playerColour(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % PLAYER_FILL.length;
}

export function PlayerBadge({ name, colour, size = "sm" }: { name: string; colour: number; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid flex-none place-items-center border-3 border-ink font-heading text-ink",
        SIZES[size],
        PLAYER_FILL[colour % PLAYER_FILL.length],
        PLAYER_RING[colour % PLAYER_RING.length],
        "leading-none [text-box:trim-both_cap_alphabetic]",
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
