import { cn } from "@/lib/utils";

export function Placeholder({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-cell motion-reduce:animate-none", className)} />;
}
