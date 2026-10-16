import { cn } from "@/lib/utils";

export function UnknownMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Not in Showdown's data"
      title="Not in Showdown's data"
      className={cn("ml-2 text-[11px] font-bold text-destructive", className)}
    >
      ?
    </span>
  );
}

export function UncheckedMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Not checked in game yet"
      title="Not checked in game yet"
      className={cn("ml-2 text-[11px] font-bold text-destructive", className)}
    >
      ?
    </span>
  );
}

function typeColour(type: string | null): string {
  return type ? `var(--type-${type.toLowerCase()}, var(--muted-foreground))` : "var(--muted-foreground)";
}

export function TypeDot({ type, className }: { type: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2.5 flex-none rounded-full", className)}
      style={{ background: typeColour(type) }}
    />
  );
}

export function TypeChip({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.25 pl-1.5 text-xs font-semibold">
      <TypeDot type={type} />
      {type}
    </span>
  );
}

export function TypeSquare({ type }: { type: string | null }) {
  return (
    <span aria-hidden="true" className="grid size-6 place-items-center rounded-md" style={{ background: typeColour(type) }}>
      <span className="size-2 rounded-full bg-foreground" />
    </span>
  );
}
