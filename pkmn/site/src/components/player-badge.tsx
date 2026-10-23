import { cn } from "@/lib/utils";

const COLOURS = [
  "bg-player-1 ring-player-1",
  "bg-player-2 ring-player-2",
  "bg-player-3 ring-player-3",
  "bg-player-4 ring-player-4",
  "bg-player-5 ring-player-5",
  "bg-player-6 ring-player-6",
] as const;

const SIZES = {
  xs: "size-8 rounded-[7px] ring-2 text-[1.375rem]",
  sm: "size-9 rounded-md ring-2 text-2xl",
  lg: "size-12.5 rounded-lg ring-3 text-3xl",
  xl: "size-16 rounded-xl border-4 ring-3 text-[2.75rem] sm:size-21 sm:rounded-[14px] sm:ring-4 sm:text-[3.5rem]",
  row: "size-8.5 rounded-lg ring-2 text-[1.375rem] sm:size-12.5 sm:ring-3 sm:text-3xl",
} as const;

export function playerColour(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % COLOURS.length;
}

export function PlayerBadge({ name, colour, size = "sm" }: { name: string; colour: number; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid flex-none place-items-center border-3 border-ink font-heading leading-none text-ink",
        SIZES[size],
        COLOURS[colour % COLOURS.length],
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
