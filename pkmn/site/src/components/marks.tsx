import { TYPE_ICONS } from "@/lib/type-icons";
import { cn } from "@/lib/utils";
import { typeLabel } from "../../shared/dex-text";
import { messages } from "../../shared/i18n";

const t = messages({
  en: { unknown: "Not in Showdown's data" },
  es: { unknown: "No está en los datos de Showdown" },
});

export function UnknownMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={t.unknown}
      title={t.unknown}
      className={cn("ml-2 text-xs font-bold text-destructive", className)}
    >
      ?
    </span>
  );
}

function typeColour(type: string | null): string {
  return type ? `var(--type-${type.toLowerCase()}, var(--muted-foreground))` : "var(--muted-foreground)";
}

function TypeIcon({ type, className }: { type: string | null; className?: string }) {
  const paths = type ? TYPE_ICONS[type] : undefined;
  if (!paths) return <span className={cn("rounded-full bg-foreground", className)} />;
  return (
    <svg viewBox="0 0 512 512" className={cn("fill-foreground", className)}>
      {paths.map((d) => (
        <path key={d} fillRule="evenodd" d={d} />
      ))}
    </svg>
  );
}

export function TypeDot({ type, className }: { type: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid size-4 flex-none place-items-center rounded-full", className)}
      style={{ background: typeColour(type) }}
    >
      <TypeIcon type={type} className="size-[62%]" />
    </span>
  );
}

export function TypeChip({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.25 pl-1.5 text-xs font-semibold">
      <TypeDot type={type} />
      {typeLabel(type)}
    </span>
  );
}

export function TypeSquare({ type }: { type: string | null }) {
  return (
    <span aria-hidden="true" className="grid size-6 place-items-center rounded-md" style={{ background: typeColour(type) }}>
      <TypeIcon type={type} className="size-[62%]" />
    </span>
  );
}
