import { cn } from "@/lib/utils";

export function MonSprite({ mon, className }: { mon: { sprite: string | null }; className?: string }) {
  if (!mon.sprite) {
    return (
      <span aria-hidden="true" className={cn("grid place-items-center font-heading text-3xl text-muted-foreground", className)}>
        ?
      </span>
    );
  }
  return <img src={mon.sprite} alt="" className={cn("[image-rendering:pixelated]", className)} />;
}
