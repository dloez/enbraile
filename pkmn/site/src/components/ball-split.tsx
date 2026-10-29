import type { ReactNode } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import { cn } from "@/lib/utils";

export function BallSplit({ title, admin = false, className, children }: { title: ReactNode; admin?: boolean; className: string; children: ReactNode }) {
  return (
    <div className="flex min-h-(--screen-h) flex-col">
      <div
        className={cn(
          "flex flex-none flex-col items-center justify-center gap-2.5 px-6 pb-10 sm:gap-3 sm:pb-15",
          admin ? "h-[calc(var(--screen-h)*0.37)] min-h-56 bg-ink" : "h-[calc(var(--screen-h)*0.51)] min-h-60 bg-red sm:h-[calc(var(--screen-h)*0.52)]",
        )}
      >
        {admin && (
          <span className="flex items-center gap-3 font-heading text-2xl text-yellow sm:text-3xl">
            <PixelIcon name="key" className="size-6 sm:size-7.5" />
            Admin
          </span>
        )}
        {title}
        {!admin && <span className="font-heading text-2xl text-blush sm:text-3xl">.enbraile.vip</span>}
      </div>
      <div className={cn("relative h-3.5 flex-none sm:h-4.5", admin ? "bg-red" : "bg-ink")}>
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 grid size-20 -translate-1/2 place-items-center rounded-full border-10 border-ink bg-foreground sm:size-30 sm:border-14"
        >
          <span className="size-7 rounded-full border-4 border-ink sm:size-10.5 sm:border-6" />
        </div>
      </div>
      <div className={`flex flex-1 flex-col items-center justify-center pt-14 sm:px-10 sm:pt-18 ${className}`}>{children}</div>
    </div>
  );
}

export const ballTitleClass = "m-0 font-heading text-8xl leading-[0.8] font-normal text-white sm:text-9xl";
