import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { liftCardClass } from "@/components/controls";
import { adminPage, AdminHomeFrame } from "@/components/page-frames";
import { PixelIcon } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { formatSize, joinedOn } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import { gameList, type Game } from "../../shared/games";
import { player, playerList, type Player } from "../../shared/players";
import { type AdminSeries, adminSeriesList } from "../../shared/series";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

type Overview = { series: AdminSeries[]; players: Player[]; games: Game[] };

export function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api("/admin/series", adminSeriesList), api("/players", playerList), api("/games", gameList)]).then(
      ([series, players, games]) => setData({ series, players, games }),
      (caught: unknown) => setError(message(caught)),
    );
  }, []);

  if (error) {
    return (
      <main className={adminPage}>
        <AdminNav />
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!data) return <AdminHomeFrame />;

  const waiting = data.players.filter((p) => !p.allowed);
  const running = data.series.find((s) => s.state === "running");
  const gameName = (id: string | null) => data.games.find((g) => g.id === id)?.name ?? null;

  return (
    <main className={adminPage}>
      <h1 className="sr-only">Admin overview</h1>
      <AdminNav waiting={waiting.length} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-5">
        {running ? <RunningBanner series={running} game={gameName(running.gameId)} /> : <NoneRunning />}
        <SeriesCard series={data.series} />
        <Waiting
          players={waiting}
          onAllowed={(updated) => setData({ ...data, players: data.players.map((p) => (p.id === updated.id ? updated : p)) })}
        />
        <GamesCard games={data.games} series={data.series} />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col rounded-[10px] bg-scene-night-panel/85 px-2.5 py-1 sm:px-3.5 sm:py-1.5">
      <span className="font-heading text-[0.9375rem] text-scene-night-panel-sub sm:text-[1.0625rem]">{label}</span>
      <span className="font-heading text-2xl leading-none text-white sm:text-3xl">{value}</span>
    </span>
  );
}

function RunningBanner({ series, game }: { series: AdminSeries; game: string | null }) {
  const look = SCENE_LOOK[series.scene];
  const desktop = useMediaQuery("(min-width: 40rem)");
  return (
    <Link
      to="/admin/series/$id"
      params={{ id: series.id }}
      className={cn(liftCardClass, "relative flex min-h-47 flex-col justify-between gap-4 overflow-hidden p-3 text-white sm:min-h-68 sm:p-5.5", look.ground)}
    >
      <SceneArt scene={series.scene} width={desktop ? 230 : 90} height={desktop ? 59 : 55} />
      <span className="relative flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col items-start gap-2 sm:gap-2.5">
          <span className={cn("font-heading text-lg sm:text-[1.375rem]", series.scene === "night" ? "text-scene-night-sparkle" : "text-ink")}>Running series</span>
          <span className={cn("font-heading text-[3.25rem] leading-[0.8] sm:text-7xl", look.title)}>{series.name}</span>
          {game && <span className={cn("rounded-md px-2.5 py-0.5 text-sm font-extrabold max-sm:hidden sm:px-3 sm:text-[1.0625rem]", look.chip)}>{game}</span>}
        </span>
        <span className="flex-none rounded-md border-3 border-ink bg-primary px-2.5 font-heading text-xl text-primary-foreground sm:px-3.5 sm:text-2xl">Playing now</span>
      </span>
      <span className="relative grid grid-cols-3 gap-1.5 sm:flex sm:items-end sm:gap-2.5">
        <Stat label="Players" value={series.playerIds.length} />
        <Stat label="Milestones" value={series.milestones.length} />
        <Stat label="Snapshots" value={series.snapshots} />
        <span className="ml-auto items-center gap-2 rounded-[10px] bg-scene-night-panel/85 px-3.5 py-1.5 font-heading text-[1.375rem] max-sm:hidden sm:flex">
          Edit series
          <PixelIcon name="arrow" className="size-3.5" />
        </span>
      </span>
    </Link>
  );
}

function NoneRunning() {
  return (
    <Link
      to="/admin/series"
      className={cn(liftCardClass, "flex min-h-47 flex-col items-center justify-center gap-2 border-dashed border-cell-hi bg-transparent p-5 text-center sm:min-h-68")}
    >
      <span className="font-heading text-3xl sm:text-4xl">No series is running</span>
      <span className="text-sm text-muted-foreground">Start one from a draft on the Series page</span>
    </Link>
  );
}

const STATE_INK = { draft: "text-warning", running: "text-primary", finished: "text-muted-foreground" } as const;

function stateLine(series: AdminSeries): string {
  if (series.state === "running") return "Playing now";
  if (series.state === "finished") return "Finished";
  return `Draft · ${series.checklist.filter((item) => item.done).length}/${series.checklist.length}`;
}

function SeriesCard({ series }: { series: AdminSeries[] }) {
  return (
    <Link to="/admin/series" className={cn(liftCardClass, "flex flex-col gap-2 p-4 sm:gap-3 sm:px-6 sm:py-5.5")}>
      <span className="flex items-center justify-between">
        <span className="font-heading text-[1.75rem] leading-none sm:text-[2.125rem]">Series</span>
        <span className="font-heading text-lg text-muted-foreground sm:text-xl">{series.length} in all</span>
      </span>
      {series.slice(0, 3).map((s) => (
        <span
          key={s.id}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 font-heading text-[1.375rem] sm:px-3.5 sm:text-2xl",
            s.state === "draft" ? "border-2 border-dashed border-cell-hi" : "bg-box",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{s.name}</span>
          <span className={cn("text-lg sm:text-[1.1875rem]", STATE_INK[s.state])}>{stateLine(s)}</span>
        </span>
      ))}
      {series.length === 0 && <span className="text-sm text-muted-foreground">No series yet</span>}
    </Link>
  );
}

function Waiting({ players, onAllowed }: { players: Player[]; onAllowed: (updated: Player) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function letIn(target: Player) {
    setBusy(target.id);
    setError(null);
    try {
      onAllowed(await api(`/players/${target.id}/allowed`, player, { body: { allowed: true } }));
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(null);
  }

  return (
    <section aria-labelledby="waiting-title" className="flex flex-col gap-2.5 rounded-2xl border-3 bg-card p-4 sm:gap-3 sm:px-5.5 sm:py-5">
      <div className="flex items-center gap-3">
        <h2 id="waiting-title" className="m-0 flex-1 font-heading text-[1.75rem] leading-none font-normal sm:text-[2.125rem]">
          Waiting to be let in
        </h2>
        <Link to="/admin/players" className="font-heading text-xl text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-[1.375rem]">
          All players
        </Link>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      {players.length === 0 ? (
        <div className="flex min-h-16 flex-1 items-center justify-center gap-3 rounded-xl border-3 border-dashed font-heading text-2xl text-muted-foreground sm:text-[1.75rem]">
          <PixelIcon name="check" className="size-5 text-green" />
          Nobody is waiting
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {players.map((p) => (
            <li key={p.id} className="flex min-h-15 items-center gap-3 rounded-xl border-2 border-cell bg-box pr-2 pl-2.5 sm:min-h-16 sm:gap-3.5 sm:pr-3 sm:pl-3.5">
              <PlayerBadge name={p.name} colour={playerColour(p.id)} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-heading text-[1.5625rem] leading-none sm:text-[1.75rem]">{p.name}</span>
                <span className="text-xs font-bold text-muted-foreground sm:text-[0.8125rem]">Signed in {joinedOn(p.joinedAt)}</span>
              </span>
              <button type="button" disabled={busy !== null} onClick={() => void letIn(p)} className={buttonVariants({ variant: "go", className: "px-3.5 text-[1.375rem] sm:px-4.5 sm:text-2xl" })}>
                Let in
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GamesCard({ games, series }: { games: Game[]; series: AdminSeries[] }) {
  const bare = games.filter((g) => !g.fileName).length;
  return (
    <Link to="/admin/games" className={cn(liftCardClass, "flex flex-col gap-3 p-4 sm:gap-3.5 sm:px-6 sm:py-5.5")}>
      <span className="flex items-center justify-between">
        <span className="font-heading text-[1.75rem] leading-none sm:text-[2.125rem]">Games</span>
        <span className="font-heading text-lg text-muted-foreground sm:text-xl">{games.length}</span>
      </span>
      {games.slice(0, 3).map((g) => {
        const used = series.filter((s) => s.gameId === g.id).length;
        return (
          <span key={g.id} className="flex items-center gap-3.5">
            <PixelIcon name="cartridge" className={cn("size-10 flex-none sm:size-12", !g.fileName && "opacity-45")} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-base font-extrabold sm:text-lg">{g.name}</span>
              <span className={cn("text-[0.8125rem] font-bold sm:text-sm", g.fileName ? "text-muted-foreground" : "text-warning")}>
                {g.fileSize !== null && g.fileName ? `${formatSize(g.fileSize)} · ${used === 1 ? "1 series" : `${used} series`}` : "No zip yet"}
              </span>
            </span>
          </span>
        );
      })}
      {games.length === 0 && <span className="text-sm text-muted-foreground">No games yet</span>}
      {bare > 0 && games.length > 3 && <span className="mt-auto text-sm text-warning">{bare} without a zip</span>}
    </Link>
  );
}
