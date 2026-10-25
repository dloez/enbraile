import { cn } from "@/lib/utils";

export function LoadingBar({ label, className }: { label: string; className?: string }) {
  return (
    <span role="progressbar" aria-label={label} className={cn("pointer-events-none inset-x-0 h-1 overflow-hidden", className)}>
      <span className="block h-full w-2/5 animate-nav-sweep bg-primary motion-reduce:w-full motion-reduce:animate-none" />
    </span>
  );
}
