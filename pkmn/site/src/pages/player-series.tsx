import { Link, useLocation, useParams } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { buttonClass } from "@/components/controls";
import { toolPage } from "@/components/page";
import { MonSprite } from "@/components/pc/summary";
import { PixelIcon } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { money, playTime } from "@/lib/records";
import { cn } from "@/lib/utils";
import { describeMember } from "@/teams/dex";
import { type FallenMon, type JourneyPage, type JourneyRecord, journeyPage } from "../../shared/journey";

const FROM = "/players/$player/series/$number";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function PlayerSeriesPage() {
  const { player, number } = useParams({ from: FROM });
  const hash = useLocation({ select: (location) => location.hash });
  const [page, setPage] = useState<JourneyPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPage(null);
    setError(null);
    api(`/series/${encodeURIComponent(number)}/trainers/${encodeURIComponent(player)}/journey`, journeyPage).then(
      (next) => live && setPage(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, [player, number]);

  useEffect(() => {
    if (page && hash) document.getElementById(hash)?.scrollIntoView();
  }, [page, hash]);

  if (error) {
    return (
      <main className={cn(toolPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!page) return <main className={toolPage} />;

  return (
    <main className={cn(toolPage, "gap-6 pt-3 pb-9 sm:gap-7 sm:pt-5 sm:pb-10")}>
      <Head page={page} />
      <Journey page={page} />
      <Fallen fallen={page.fallen} />
    </main>
  );
}

function Head({ page }: { page: JourneyPage }) {
  const { data } = authClient.useSession();
  const you = data?.user.id === page.player.id;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <nav aria-label="Breadcrumb" className="-my-2.5 flex items-center gap-2.5 font-heading text-[1.375rem] sm:my-0">
          <Link
            to="/players/$player"
            params={{ player: page.player.id }}
            className="flex min-h-11 items-center gap-2 text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-0"
          >
            <svg viewBox="0 0 14 18" aria-hidden="true" className="h-3 w-2 fill-current">
              <path d="M12 2L2 9l10 7z" />
            </svg>
            {page.player.name}
          </Link>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <Link
            to="/series/$number"
            params={{ number: String(page.series.number) }}
            className="flex min-h-11 items-center text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-0"
          >
            Series {page.series.number}
          </Link>
        </nav>
        <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
          <Link to="/players/$player" params={{ player: page.player.id }} aria-label={`${page.player.name}'s profile`} className="flex-none rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <PlayerBadge name={page.player.name} colour={playerColour(page.player.id)} size="lg" />
          </Link>
          <h1 className="m-0 min-w-0 font-heading text-[2.75rem] leading-[0.85] font-normal sm:text-6xl">
            {page.player.name} in Series {page.series.number}
          </h1>
          {you && <span className="flex-none rounded-sm bg-yellow px-2 font-heading text-lg text-ink">You</span>}
        </div>
      </div>
      <div className="hidden flex-1 sm:block" />
      <Link
        to="/players/$player/series/$number/pc"
        params={{ player: page.player.id, number: String(page.series.number) }}
        search={{}}
        className={cn(buttonClass, "min-h-13 justify-start px-4 sm:px-4.5")}
      >
        <PixelIcon name="monitor" className="size-4.5 text-primary" />
        {page.player.name}'s PC
        {page.latest && (
          <span className="ml-auto rounded-[5px] bg-ink px-2 text-xl leading-6.5 text-subtle sm:ml-1">{page.latest} · latest</span>
        )}
      </Link>
    </div>
  );
}

type Row = { label: string; cell: (r: JourneyRecord) => { main: string; sub?: string; alarm?: boolean; subAlarm?: boolean } };

function count(n: number | null): string {
  return n === null ? "—" : String(n);
}

function Journey({ page }: { page: JourneyPage }) {
  const desktop = useMediaQuery("(min-width: 40rem)");
  const n = page.columns.length;
  const template = desktop ? `200px repeat(${n}, minmax(96px, 1fr))` : `120px repeat(${n}, 92px)`;
  const previous = (index: number) => page.columns.slice(0, index).findLast((c) => c.record !== null)?.record ?? null;
  const rows: Row[] = [
    { label: "Play time", cell: (r) => ({ main: playTime(r.playTime) }) },
    { label: "Badges", cell: (r) => ({ main: r.badgeSlots === 0 ? "—" : `${r.badges} / ${r.badgeSlots}` }) },
    { label: "Money", cell: (r) => ({ main: money(r.money) }) },
    { label: "Pokédex", cell: (r) => (r.owned === null ? { main: "—" } : { main: `${r.owned} owned`, sub: `${count(r.seen)} seen` }) },
    { label: "Trainer battles", cell: (r) => ({ main: `${count(r.trainerBattlesWon)} – ${count(r.trainerBattlesLost)}`, sub: "won – lost" }) },
    { label: "Blackouts", cell: (r) => ({ main: count(r.blackouts) }) },
  ];
  const sticky = "sticky left-0 z-1 border-r-3 sm:static sm:border-r-0";

  return (
    <>
      <h2 id="journey" className="-mb-3 scroll-mt-4 font-heading text-[2.125rem] font-normal sm:-mb-3.5 sm:text-[2.375rem]">
        Journey
      </h2>
      <section aria-labelledby="journey" className="overflow-hidden rounded-[18px] border-3 bg-card">
        <div
          role="table"
          aria-label="Records at each milestone"
          tabIndex={desktop ? undefined : 0}
          className="overflow-x-auto tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div role="row" className="grid w-max border-b-3 bg-box sm:w-auto" style={{ gridTemplateColumns: template }}>
            <span role="columnheader" className={cn(sticky, "bg-box")} />
            {page.columns.map((column) => (
              <span key={column.milestone} role="columnheader" className="flex">
                {column.record ? (
                  <Link
                    to="/players/$player/series/$number/pc"
                    params={{ player: page.player.id, number: String(page.series.number) }}
                    search={{ snapshot: column.milestone }}
                    aria-label={`${page.player.name}'s PC at ${column.milestone}`}
                    title={`${page.player.name}'s PC at ${column.milestone}`}
                    className="flex min-h-13 flex-1 items-center justify-center gap-1.5 font-heading text-xl whitespace-nowrap text-foreground outline-none hover:bg-row-hi focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:min-h-13.5 sm:gap-2 sm:text-[1.375rem]"
                  >
                    {column.milestone}
                    <svg viewBox="0 0 14 18" aria-hidden="true" className="h-2.5 w-1.75 fill-primary">
                      <path d="M2 2l10 7-10 7z" />
                    </svg>
                  </Link>
                ) : (
                  <span className="flex min-h-13 flex-1 items-center justify-center font-heading text-xl whitespace-nowrap text-faint sm:min-h-13.5 sm:text-[1.375rem]">
                    {column.milestone}
                  </span>
                )}
              </span>
            ))}
          </div>
          {rows.map((row) => (
            <JourneyRow key={row.label} label={row.label} template={template} sticky={sticky}>
              {page.columns.map((column) => (
                <Cell key={column.milestone} value={column.record && row.cell(column.record)} />
              ))}
            </JourneyRow>
          ))}
          <JourneyRow label="Fainted" template={template} sticky={sticky}>
            {page.columns.map((column, index) => {
              const r = column.record;
              const before = previous(index);
              const added = r && before ? r.fainted - before.fainted : 0;
              return (
                <Cell
                  key={column.milestone}
                  value={r && { main: String(r.fainted), alarm: r.fainted > 0, sub: added > 0 ? `+${added}` : undefined, subAlarm: true }}
                />
              );
            })}
          </JourneyRow>
        </div>
      </section>
    </>
  );
}

function JourneyRow({ label, template, sticky, children }: { label: string; template: string; sticky: string; children: ReactNode }) {
  return (
    <div role="row" className="grid w-max border-b sm:w-auto" style={{ gridTemplateColumns: template }}>
      <span
        role="rowheader"
        className={cn(
          sticky,
          "flex min-h-13 items-center bg-card px-3 font-heading text-xl leading-none text-muted-foreground sm:min-h-13.5 sm:px-5 sm:text-[1.375rem] sm:whitespace-nowrap",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Cell({ value }: { value: { main: string; sub?: string; alarm?: boolean; subAlarm?: boolean } | null }) {
  if (!value) {
    return (
      <span role="cell" className="flex items-center justify-center px-1.5 py-1.5 text-[0.9375rem] font-bold text-faint sm:px-2 sm:text-base">
        —
      </span>
    );
  }
  return (
    <span role="cell" className="flex flex-col items-center justify-center px-1.5 py-1.5 leading-[1.15] whitespace-nowrap sm:px-2">
      <span className={cn("text-[0.9375rem] font-bold sm:text-base", value.alarm ? "text-destructive" : "text-foreground")}>{value.main}</span>
      {value.sub && (
        <span className={cn("text-xs font-bold sm:text-[0.8125rem]", value.subAlarm ? "text-destructive" : "text-muted-foreground")}>
          {value.sub}
        </span>
      )}
    </span>
  );
}

function Fallen({ fallen }: { fallen: FallenMon[] }) {
  return (
    <section aria-labelledby="fallen" className="flex flex-col gap-3 sm:gap-3.5">
      <div className="flex items-baseline gap-3 sm:gap-3.5">
        <h2 id="fallen" className="m-0 scroll-mt-4 font-heading text-[2.125rem] font-normal sm:text-[2.375rem]">
          Fallen
        </h2>
        <span className="font-heading text-[1.75rem] text-muted-foreground sm:text-3xl">{fallen.length}</span>
      </div>
      {fallen.length > 0 && (
        <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] sm:gap-3.5">
          {fallen.map((mon, index) => (
            <FallenCard key={index} mon={mon} />
          ))}
        </div>
      )}
    </section>
  );
}

function FallenCard({ mon }: { mon: FallenMon }) {
  const look = describeMember(mon.species, mon.gameSpecies);
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] border-3 bg-card py-2.5 pr-3.5 pl-2.5 sm:gap-4 sm:py-3 sm:pr-4.5 sm:pl-3">
      <span className="grid size-16 flex-none place-items-center overflow-hidden rounded-xl bg-box sm:size-18">
        <MonSprite mon={look} className="size-18 opacity-60 grayscale sm:size-20" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-heading text-[1.75rem] leading-[0.9] sm:text-3xl">{mon.nickname ?? look.name}</span>
        <span className="text-sm font-bold text-muted-foreground">
          {look.name} · Lv. {mon.level ?? "?"}
        </span>
        <span className="flex items-center self-start rounded-full bg-destructive-soft px-2.5 py-0.5 font-heading text-xl leading-none text-destructive">
          {mon.from ? `${mon.from} → ${mon.to}` : `by ${mon.to}`}
        </span>
      </span>
    </div>
  );
}
