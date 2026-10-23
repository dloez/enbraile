import type { ReactNode } from "react";

export function BallSplit({ title, className, children }: { title: ReactNode; className: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex h-[51svh] min-h-60 flex-none flex-col items-center justify-center gap-2.5 bg-red px-6 pb-10 sm:h-[52svh] sm:gap-3 sm:pb-15">
        {title}
        <span className="font-heading text-2xl text-blush sm:text-3xl">.enbraile.vip</span>
      </div>
      <div className="relative h-3.5 flex-none bg-ink sm:h-4.5">
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
