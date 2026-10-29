import { Link, useParams } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { liftCardClass } from "@/components/controls";
import { toolPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { useMediaQuery } from "@/hooks/use-media-query";
import { stageName } from "@/league/cup";
import { combatsLabel, Pips } from "@/league/tries";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { ordinal, playTime } from "@/lib/records";
import { cn } from "@/lib/utils";
import { ProfileFrame } from "@/components/page-frames";
import { BANNER_SIZE, gameLine, PHONE_BANNER_SIZE } from "@/pages/series-list";
import { messages } from "../../shared/i18n";
import { type CareerTotals, type ProfileLeague, type ProfilePage, type ProfileSeries, profilePage } from "../../shared/profile";

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
    league: "League",
    place: "Place",
    points: "Points",
    wl: "W–L",
    pokemonLeague: "Pokémon League",
    cup: "Cup",
    champion: "Champion",
    round: (n: number) => `Round ${n}`,
    ordinal: (n: number) => ordinal(n, "en"),
    open: (series: string) => `Open ${series}'s league`,
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
    league: "Liga",
    place: "Puesto",
    points: "Puntos",
    wl: "V–D",
    pokemonLeague: "Liga Pokémon",
    cup: "Copa",
    champion: "Campeón",
    round: (n: number) => `Ronda ${n}`,
    ordinal: (n: number) => ordinal(n, "es"),
    open: (series: string) => `Abrir la liga de ${series}`,
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
      <Career career={page.career} leagues={page.leagues} />
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

function Career({ career, leagues }: { career: CareerTotals; leagues: ProfileLeague[] }) {
  const desktop = useMediaQuery("(min-width: 40rem)");
  const wide = useMediaQuery("(min-width: 64rem)");
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
      {leagues.length > 0 && (wide ? <LeagueTable leagues={leagues} /> : <LeagueCards leagues={leagues} />)}
    </section>
  );
}

const LEAGUE_COLUMNS = "grid-cols-[minmax(0,1fr)_120px_120px_120px_200px_180px_40px]";

function leagueState(league: ProfileLeague): { label: string; running: boolean } {
  if (league.state !== "running") return { label: t.done, running: false };
  if (league.cupOn) return { label: t.cup, running: true };
  return { label: league.round === null ? t.playing : t.round(league.round), running: true };
}

function cupLabel(league: ProfileLeague): { label: string; ink: string } {
  if (!league.cup) return { label: "—", ink: "text-faint" };
  if (league.cup.champion) return { label: t.champion, ink: "text-yellow" };
  return { label: stageName(league.cup, true), ink: "text-foreground" };
}

function StateChip({ league, className }: { league: ProfileLeague; className: string }) {
  const state = leagueState(league);
  return <span className={cn("rounded-[5px] font-heading", state.running ? "bg-red text-white" : "bg-ink text-subtle", className)}>{state.label}</span>;
}

function TriesPips({ best }: { best: number | null }) {
  return (
    <>
      {best === null ? <span className="font-heading text-2xl text-faint">—</span> : <Pips won={best} size="md" />}
      <span className="sr-only">{combatsLabel(best)}</span>
    </>
  );
}

function LeagueLink({ league, className, children, role }: { league: ProfileLeague; className: string; children: ReactNode; role?: "row" }) {
  return (
    <Link
      to="/series/$number/league"
      params={{ number: String(league.number) }}
      role={role}
      aria-label={role ? undefined : t.open(league.name)}
      className={cn("text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      {children}
    </Link>
  );
}

function LeagueTable({ leagues }: { leagues: ProfileLeague[] }) {
  const heads = [t.place, t.points, t.wl, t.pokemonLeague, t.cup];
  return (
    <div role="table" aria-label={t.league} className="overflow-hidden rounded-[18px] border-3 bg-card">
      <div role="row" className={cn("grid min-h-12 items-center border-b-3 bg-box px-5 font-heading text-xl text-muted-foreground", LEAGUE_COLUMNS)}>
        <span role="columnheader">{t.league}</span>
        {heads.map((head) => (
          <span key={head} role="columnheader" className="text-center">
            {head}
          </span>
        ))}
        <span />
      </div>
      {leagues.map((league, index) => {
        const cup = cupLabel(league);
        return (
          <LeagueLink
            key={league.number}
            role="row"
            league={league}
            className={cn("grid min-h-17 items-center px-5 hover:bg-row-hi focus-visible:ring-inset", LEAGUE_COLUMNS, index < leagues.length - 1 && "border-b-3")}
          >
            <span role="cell" className="flex min-w-0 items-center gap-3">
              <span className="truncate font-heading text-3xl">{league.name}</span>
              <StateChip league={league} className="flex-none px-2 py-px text-lg" />
            </span>
            <span role="cell" className={cn("text-center font-heading text-[2rem]", league.place === 1 && "text-yellow")}>
              {t.ordinal(league.place)}
            </span>
            <span role="cell" className="text-center font-heading text-[2rem]">
              {league.points}
            </span>
            <span role="cell" className="text-center font-heading text-[1.625rem] text-subtle">
              {league.wins}–{league.losses}
            </span>
            <span role="cell" className="flex justify-center">
              <TriesPips best={league.best} />
            </span>
            <span role="cell" className={cn("text-center font-heading text-[1.625rem]", cup.ink)}>
              {cup.label}
            </span>
            <Chevron className="h-5 w-3.5 justify-self-end" />
          </LeagueLink>
        );
      })}
    </div>
  );
}

function LeagueCards({ leagues }: { leagues: ProfileLeague[] }) {
  return (
    <>
      <h3 className="m-0 mt-1 font-heading text-[1.75rem] font-normal">{t.league}</h3>
      {leagues.map((league) => {
        const cup = cupLabel(league);
        const boxes = [
          { label: t.place, value: t.ordinal(league.place), ink: league.place === 1 ? "text-yellow" : "text-foreground", size: "text-[1.75rem]" },
          { label: t.points, value: String(league.points), ink: "text-foreground", size: "text-[1.75rem]" },
          { label: t.wl, value: `${league.wins}–${league.losses}`, ink: "text-subtle", size: "text-2xl" },
          { label: t.cup, value: cup.label, ink: cup.ink, size: "text-[1.375rem]" },
        ];
        return (
          <LeagueLink key={league.number} league={league} className="flex flex-col gap-2.5 rounded-[14px] border-3 bg-card p-3 hover:border-primary">
            <span className="flex items-center gap-2.5">
              <span className="font-heading text-[1.75rem] leading-none">{league.name}</span>
              <StateChip league={league} className="px-1.75 py-px text-base" />
              <span className="flex-1" />
              <Chevron className="h-4.5 w-3 flex-none" />
            </span>
            <span className="grid grid-cols-4 gap-1.5">
              {boxes.map((box) => (
                <span key={box.label} className="flex min-w-0 flex-col gap-0.5 rounded-[10px] border-3 bg-box px-2 py-1.5">
                  <span className="truncate font-heading text-base text-muted-foreground">{box.label}</span>
                  <span title={box.value} className={cn("truncate font-heading leading-[0.95]", box.size, box.ink)}>
                    {box.value}
                  </span>
                </span>
              ))}
            </span>
            <span className="flex items-center gap-2.5">
              <span className="font-heading text-lg text-muted-foreground">{t.pokemonLeague}</span>
              <TriesPips best={league.best} />
            </span>
          </LeagueLink>
        );
      })}
    </>
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
