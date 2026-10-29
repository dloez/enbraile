import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { listPage, toolPage, readPage } from "@/components/page";
import { Placeholder } from "@/components/placeholder";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";

const t = messages({
  en: { league: "League", teams: "Teams", series: "Series", trainers: "Trainers", career: "Career", journey: "Journey" },
  es: { league: "Liga", teams: "Equipos", series: "Series", trainers: "Entrenadores", career: "Trayectoria", journey: "Recorrido" },
});

export function League() {
  return (
    <section aria-labelledby="league-title" className="mb-4 flex flex-col gap-3 sm:mb-5.5 sm:gap-3.5">
      <h2 id="league-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
        {t.league}
      </h2>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Placeholder className="h-60 rounded-[18px]" />
        <Placeholder className="h-60 rounded-[18px]" />
      </div>
    </section>
  );
}

export function LeagueFrame({ wide = false }: { wide?: boolean }) {
  return (
    <main className={cn(wide ? toolPage : listPage, "gap-4 pt-4 pb-8 sm:gap-5.5 sm:pt-5.5 sm:pb-10")}>
      <div className="flex flex-col gap-2.5 sm:gap-3.5">
        <Placeholder className="h-6 w-24 rounded-md" />
        <h1 className="m-0 font-heading text-[3.25rem] leading-[0.85] font-normal sm:text-6xl">{t.league}</h1>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-5">
        <Placeholder className="h-110 rounded-[18px]" />
        <Placeholder className="h-80 rounded-[18px]" />
      </div>
    </main>
  );
}

export function MatchFrame() {
  return (
    <main className={cn(listPage, "gap-4 pt-4 pb-8 sm:gap-4.5 sm:pt-4.5 sm:pb-8")}>
      <Placeholder className="h-6 w-56 rounded-md" />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <Placeholder className="h-16 w-40 rounded-xl" />
        <Placeholder className="h-14 w-28 rounded-xl sm:h-20 sm:w-40" />
        <Placeholder className="h-16 w-40 justify-self-end rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)_minmax(0,430px)] lg:gap-5">
        <div className="flex flex-col gap-3 lg:order-2">
          <Placeholder className="h-18 rounded-xl" />
          <Placeholder className="h-80 rounded-[18px]" />
        </div>
        <Placeholder className="h-24 rounded-[14px] lg:order-1 lg:h-full" />
        <Placeholder className="h-24 rounded-[14px] lg:order-3 lg:h-full" />
      </div>
    </main>
  );
}

export function TeamsBackLink() {
  return (
    <Link
      to="/teams"
      className="-my-2.5 flex min-h-11 w-fit items-center gap-1.5 font-heading text-[1.375rem] text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      {t.teams}
    </Link>
  );
}

export function TwoBlocks({ className }: { className: string }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Placeholder className={className} />
      <Placeholder className={className} />
    </div>
  );
}

export function SeriesListFrame() {
  return (
    <main className={cn(toolPage, "gap-4.5 pt-5.5 pb-8 sm:gap-5.5 sm:py-9")}>
      <h1 className="m-0 font-heading text-5xl leading-none font-normal sm:text-6xl">{t.series}</h1>
      <TwoBlocks className="h-35 rounded-2xl" />
    </main>
  );
}

export function SeriesFrame() {
  return (
    <>
      <Placeholder className="h-55 sm:h-65" />
      <main className={cn(readPage, "flex-none gap-3 pt-5 pb-6 sm:gap-3.5 sm:pt-6 sm:pb-8")}>
        <League />
        <section aria-labelledby="trainers-title" className="flex flex-col gap-3 sm:gap-3.5">
          <h2 id="trainers-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
            {t.trainers}
          </h2>
          <Placeholder className="h-60 rounded-2xl" />
        </section>
      </main>
    </>
  );
}

export function ProfileFrame() {
  return (
    <main className={cn(toolPage, "gap-7 pt-5.5 pb-9 sm:gap-8 sm:pt-9 sm:pb-12")}>
      <div className="flex items-center gap-4 sm:gap-5.5">
        <Placeholder className="size-16 rounded-xl sm:size-21 sm:rounded-[14px]" />
        <Placeholder className="h-12 w-40 rounded-xl sm:h-16 sm:w-56" />
      </div>
      <section aria-labelledby="career" className="flex flex-col gap-3 sm:gap-3.5">
        <h2 id="career" className="m-0 font-heading text-[2.125rem] font-normal sm:text-[2.375rem]">
          {t.career}
        </h2>
        <Placeholder className="h-110 rounded-2xl sm:h-63" />
      </section>
      <section aria-labelledby="series" className="flex flex-col gap-3 sm:gap-3.5">
        <h2 id="series" className="m-0 font-heading text-[2.125rem] font-normal sm:text-[2.375rem]">
          {t.series}
        </h2>
        <Placeholder className="h-49 rounded-2xl sm:h-42" />
      </section>
    </main>
  );
}

export function PlayerSeriesFrame() {
  return (
    <main className={cn(toolPage, "gap-6 pt-3 pb-9 sm:gap-7 sm:pt-5 sm:pb-10")}>
      <Placeholder className="h-20 w-full max-w-105 rounded-xl sm:h-23" />
      <h2 id="journey" className="-mb-3 scroll-mt-4 font-heading text-[2.125rem] font-normal sm:-mb-3.5 sm:text-[2.375rem]">
        {t.journey}
      </h2>
      <Placeholder className="h-108 rounded-[18px] sm:h-112" />
    </main>
  );
}

export function PcFrame() {
  return (
    <main className={cn(toolPage, "pt-5 lg:max-h-[calc(100svh-4rem)] lg:min-h-144")}>
      <Placeholder className="h-23 w-full max-w-74 rounded-xl" />
      <div className="flex flex-1 gap-6 pt-3.5 pb-3 sm:pb-6 lg:min-h-0">
        <Placeholder className="min-h-120 flex-1 rounded-[18px]" />
        <Placeholder className="hidden w-95 rounded-[18px] lg:block" />
      </div>
    </main>
  );
}

export function TeamsFrame() {
  return (
    <main className={cn(toolPage, "gap-5 pt-5.5 pb-8 sm:gap-6 sm:pt-6")}>
      <h1 className="m-0 font-heading text-5xl leading-[0.85] font-normal sm:text-6xl">{t.teams}</h1>
      <TwoBlocks className="h-32 rounded-2xl" />
    </main>
  );
}

export function TeamFrame() {
  return (
    <main className={cn(toolPage, "gap-4 pt-4.5 pb-6 lg:max-h-[calc(100svh-4rem)] lg:min-h-160 lg:pb-7")}>
      <TeamsBackLink />
      <Placeholder className="h-14 w-full max-w-120 rounded-xl" />
      <div className="flex min-h-0 flex-1 gap-6">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[min(896px,62%)] lg:flex-none">
          {Array.from({ length: 6 }, (_, i) => (
            <Placeholder key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
        <Placeholder className="hidden flex-1 rounded-[18px] lg:block" />
      </div>
    </main>
  );
}

export const adminPage = cn(listPage, "gap-5 pt-4 pb-8 sm:gap-5.5 sm:pt-6.5 sm:pb-9");

export function AdminHomeFrame() {
  return (
    <main className={adminPage}>
      <AdminNav />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-5">
        <Placeholder className="h-47 rounded-2xl lg:h-68" />
        <Placeholder className="h-44 rounded-2xl lg:h-68" />
        <Placeholder className="h-60 rounded-2xl" />
        <Placeholder className="h-24 rounded-2xl lg:h-60" />
      </div>
    </main>
  );
}

export function AdminSeriesListFrame() {
  return (
    <main className={adminPage}>
      <AdminNav />
      <Placeholder className="h-56 rounded-2xl sm:h-22" />
      <div className="flex flex-col gap-4.5">
        <Placeholder className="h-37.5 rounded-2xl" />
        <Placeholder className="h-37.5 rounded-2xl" />
      </div>
    </main>
  );
}

export function AdminSeriesFrame() {
  return (
    <main className={adminPage}>
      <AdminNav />
      <Placeholder className="h-37.5 rounded-2xl sm:h-42.5" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Placeholder className="h-80 rounded-2xl sm:h-72" />
          <Placeholder className="h-60 rounded-2xl sm:h-44" />
          <Placeholder className="h-160 rounded-2xl sm:h-180" />
        </div>
        <Placeholder className="h-72 rounded-2xl lg:w-90 lg:flex-none" />
      </div>
    </main>
  );
}

export function AdminPlayersFrame() {
  return (
    <main className={adminPage}>
      <AdminNav />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23.75rem] lg:gap-6">
        <div className="flex flex-col gap-5">
          <Placeholder className="h-72 rounded-2xl" />
          <Placeholder className="h-96 rounded-2xl" />
        </div>
        <Placeholder className="h-80 rounded-2xl" />
      </div>
    </main>
  );
}

export function AdminGamesFrame() {
  return (
    <main className={adminPage}>
      <AdminNav />
      <Placeholder className="h-38 rounded-2xl sm:h-22" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Placeholder className="h-64 rounded-2xl" />
        <Placeholder className="h-64 rounded-2xl" />
      </div>
    </main>
  );
}
