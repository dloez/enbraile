import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { liftCardClass } from "@/components/controls";
import { toolPage } from "@/components/page";
import { PixelIcon } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { playTime } from "@/lib/records";
import { cn } from "@/lib/utils";
import { ProfileFrame } from "@/components/page-frames";
import { BANNER_SIZE, gameLine, PHONE_BANNER_SIZE } from "@/pages/series-list";
import { messages } from "../../shared/i18n";
import { type CareerTotals, type ProfilePage, type ProfileSeries, profilePage } from "../../shared/profile";

const t = messages({
  en: {
    failed: "Something went wrong",
    series: "Series",
    you: "You",
    since: (series: string) => `Trainer since ${series}`,
    finished: (n: number) => `${n} finished`,
    playTime: "Play time",
    badges: "Badges",
    of: (n: number) => `of ${n}`,
    bestPokedex: "Best Pokédex",
    ownedIn: (series: string) => `owned · ${series}`,
    battles: "Trainer battles",
    wonLost: "won – lost",
    blackouts: "Blackouts",
    fallen: "Fallen",
    career: "Career",
    league: "League results · Work in progress",
    reached: "Reached",
    teams: "Teams",
    playing: "Playing now",
    done: "Finished",
  },
  es: {
    failed: "Algo ha fallado",
    series: "Series",
    you: "Tú",
    since: (series: string) => `Entrenador desde ${series}`,
    finished: (n: number) => (n === 1 ? "1 terminada" : `${n} terminadas`),
    playTime: "Tiempo de juego",
    badges: "Medallas",
    of: (n: number) => `de ${n}`,
    bestPokedex: "Mejor Pokédex",
    ownedIn: (series: string) => `capturados · ${series}`,
    battles: "Combates de entrenador",
    wonLost: "ganados – perdidos",
    blackouts: "Desmayos",
    fallen: "Caídos",
    career: "Trayectoria",
    league: "Resultados de la liga · En obras",
    reached: "Llegó a",
    teams: "Equipos",
    playing: "En juego",
    done: "Terminada",
  },
});

const FROM = "/players/$player";

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

function count(n: number | null): string {
  return n === null ? "—" : String(n);
}

export function PlayerProfilePage() {
  const { player } = useParams({ from: FROM });
  const [page, setPage] = useState<ProfilePage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPage(null);
    setError(null);
    api(`/profiles/${encodeURIComponent(player)}`, profilePage).then(
      (next) => live && setPage(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, [player]);

  if (error) {
    return (
      <main className={cn(toolPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!page) return <ProfileFrame />;

  return (
    <main className={cn(toolPage, "gap-7 pt-5.5 pb-9 sm:gap-8 sm:pt-9 sm:pb-12")}>
      <Head page={page} />
      <Career career={page.career} />
      <section aria-labelledby="series" className="flex flex-col gap-3 sm:gap-3.5">
        <h2 id="series" className="m-0 font-heading text-[2.125rem] font-normal sm:text-[2.375rem]">
          {t.series}
        </h2>
        {page.series.map((s) => (
          <SeriesBanner key={s.number} player={page.player.id} series={s} />
        ))}
      </section>
    </main>
  );
}

function Head({ page }: { page: ProfilePage }) {
  const { data } = authClient.useSession();
  const you = data?.user.id === page.player.id;
  return (
    <div className="flex items-center gap-4 sm:gap-5.5">
      <PlayerBadge name={page.player.name} colour={playerColour(page.player.name)} size="xl" />
      <div className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
          <h1 className="m-0 min-w-0 truncate font-heading text-6xl leading-[0.8] font-normal sm:text-[5.25rem]">{page.player.name}</h1>
          {you && <span className="flex-none rounded-sm bg-yellow px-1.75 font-heading text-lg text-ink sm:px-2 sm:text-xl">{t.you}</span>}
        </div>
        {page.since && <span className="font-heading text-[1.375rem] text-muted-foreground sm:text-2xl">{t.since(page.since)}</span>}
      </div>
    </div>
  );
}

type Total = { label: string; value: string; sub?: string; alarm?: boolean; wide: boolean };

function Career({ career }: { career: CareerTotals }) {
  const desktop = useMediaQuery("(min-width: 40rem)");
  const series: Total = { label: t.series, value: String(career.series), sub: t.finished(career.finished), wide: false };
  const time: Total = { label: t.playTime, value: playTime(career.playTime), wide: true };
  const badges: Total = {
    label: t.badges,
    value: career.badgeSlots === 0 ? "—" : String(career.badges),
    sub: career.badgeSlots === 0 ? undefined : t.of(career.badgeSlots),
    wide: false,
  };
  const pokedex: Total = {
    label: t.bestPokedex,
    value: career.bestPokedex ? String(career.bestPokedex.owned) : "—",
    sub: career.bestPokedex ? t.ownedIn(career.bestPokedex.series) : undefined,
    wide: true,
  };
  const battles: Total = {
    label: t.battles,
    value: `${count(career.trainerBattlesWon)} – ${count(career.trainerBattlesLost)}`,
    sub: t.wonLost,
    wide: true,
  };
  const blackouts: Total = { label: t.blackouts, value: count(career.blackouts), wide: false };
  const fallen: Total = { label: t.fallen, value: String(career.fallen), alarm: career.fallen > 0, wide: true };
  const totals = desktop
    ? [series, time, badges, pokedex, battles, blackouts, fallen]
    : [series, badges, blackouts, time, battles, pokedex, fallen];
  return (
    <section aria-labelledby="career" className="flex flex-col gap-3 sm:gap-3.5">
      <h2 id="career" className="m-0 font-heading text-[2.125rem] font-normal sm:text-[2.375rem]">
        {t.career}
      </h2>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-7 sm:gap-3">
        {totals.map((total) => (
          <div
            key={total.label}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-[14px] border-3 bg-card px-3 py-2.5 sm:col-span-1 sm:gap-1.5 sm:px-4 sm:py-3.5",
              total.wide ? "col-span-3" : "col-span-2",
            )}
          >
            <span className="truncate font-heading text-lg text-muted-foreground sm:text-xl">{total.label}</span>
            <span
              className={cn(
                "truncate font-heading text-[2rem] leading-[0.9] tabular-nums sm:text-[2.375rem]",
                total.alarm ? "text-destructive" : "text-foreground",
              )}
            >
              {total.value}
            </span>
            <span className="min-h-4.5 truncate text-[0.8125rem] font-bold text-muted-foreground sm:min-h-5 sm:text-sm">{total.sub}</span>
          </div>
        ))}
      </div>
      <div className="flex min-h-21 items-center justify-center gap-3 rounded-[18px] border-3 border-dashed border-cell-hi bg-box px-4 py-3 sm:min-h-27.5 sm:gap-4.5">
        <PixelIcon name="barrier" className="size-9 flex-none sm:size-11" />
        <span className="font-heading text-2xl leading-[1.05] text-yellow sm:text-3xl">{t.league}</span>
      </div>
    </section>
  );
}

function SeriesBanner({ player, series }: { player: string; series: ProfileSeries }) {
  const look = SCENE_LOOK[series.scene];
  const desktop = useMediaQuery("(min-width: 40rem)");
  const [width, height] = (desktop ? BANNER_SIZE : PHONE_BANNER_SIZE)[series.scene];
  const playing = series.state === "running";
  const stats = [
    { label: t.reached, value: series.reached ?? "—", ink: series.reachedEnd ? "text-yellow" : "text-white" },
    { label: t.playTime, value: playTime(series.playTime), ink: "text-white" },
    { label: t.fallen, value: count(series.fallen), ink: series.fallen ? "text-coral" : "text-white" },
    { label: t.teams, value: String(series.teams), ink: "text-white" },
  ];
  return (
    <Link
      to="/players/$player/series/$number"
      params={{ player, number: String(series.number) }}
      className={cn(liftCardClass, "relative block overflow-hidden rounded-[18px] text-white sm:h-42", look.ground)}
    >
      <SceneArt scene={series.scene} width={width} height={height} />
      <span className="relative flex flex-col gap-3.5 px-3.5 pt-4 pb-3.5 sm:h-full sm:flex-row sm:items-center sm:gap-7 sm:px-8 sm:py-0">
        <span className="flex items-start gap-2.5 sm:flex-1">
          <span className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:gap-2.5">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:gap-3.5">
              <span className={cn("font-heading text-[3.25rem] leading-[0.8] sm:text-7xl", look.title)}>{series.name}</span>
              <span
                className={cn(
                  "rounded-[5px] px-2 font-heading text-lg sm:px-2.5 sm:text-xl",
                  playing ? "bg-red text-white" : "bg-ink text-subtle",
                )}
              >
                {playing ? t.playing : t.done}
              </span>
            </span>
            {series.game && (
              <span className={cn("rounded-md px-2.5 py-0.5 text-[0.9375rem] font-extrabold sm:px-3 sm:text-[1.0625rem]", look.chip)}>
                {gameLine(series.game)}
              </span>
            )}
          </span>
          <Chevron className="mt-2 h-4.5 w-3 flex-none sm:hidden" />
        </span>
        <span className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2.5">
          {stats.map((x) => (
            <span
              key={x.label}
              className="flex min-w-0 flex-col gap-0.5 rounded-[10px] border-3 border-scene-night-panel-edge bg-scene-night-panel px-2 py-1.5 sm:min-w-34 sm:flex-none sm:rounded-xl sm:px-3.5 sm:py-2.5"
            >
              <span className="truncate font-heading text-base text-scene-night-panel-sub sm:text-lg">{x.label}</span>
              <span title={x.value} className={cn("truncate font-heading text-2xl leading-[0.95] sm:overflow-visible sm:text-[2rem]", x.ink)}>
                {x.value}
              </span>
            </span>
          ))}
        </span>
        <Chevron className="hidden h-5 w-3.5 flex-none sm:block" />
      </span>
    </Link>
  );
}

function Chevron({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 14 18" aria-hidden="true" className={cn("fill-primary", className)}>
      <path d="M2 2l10 7-10 7z" />
    </svg>
  );
}
