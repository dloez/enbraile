import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { formFieldClass, formLabelClass, liftCardClass } from "@/components/controls";
import { adminPage, AdminSeriesListFrame } from "@/components/page-frames";
import { PixelIcon } from "@/components/pixel-icon";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { adminSeriesPage } from "@/lib/lazy-pages";
import { cn } from "@/lib/utils";
import { BANNER_SIZE, PHONE_BANNER_SIZE } from "@/pages/series-list";
import { gameList, type Game } from "../../shared/games";
import { type AdminSeries, adminSeries, adminSeriesList } from "../../shared/series";

export const STATE_NAMES: Record<AdminSeries["state"], string> = { draft: "Draft", running: "Playing now", finished: "Finished" };

export const STATE_CHIP: Record<AdminSeries["state"], string> = {
  draft: "bg-warning text-ink",
  running: "bg-primary text-primary-foreground",
  finished: "bg-ink text-foreground",
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function AdminSeriesListPage() {
  const [list, setList] = useState<AdminSeries[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api("/admin/series", adminSeriesList), api("/games", gameList)]).then(
      ([series, gameRows]) => {
        setList(series);
        setGames(gameRows);
      },
      (caught: unknown) => setError(message(caught)),
    );
  }, []);

  const listed = list !== null && list.length > 0;

  useEffect(() => {
    if (listed) adminSeriesPage.load();
  }, [listed]);

  if (!list && !error) return <AdminSeriesListFrame />;
  const next = Math.max(0, ...(list ?? []).map((s) => s.number)) + 1;

  return (
    <main className={adminPage}>
      <h1 className="sr-only">Admin series</h1>
      <AdminNav />
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {list && <NewSeries key={next} next={next} />}
      {list && (
        <ul className="m-0 flex list-none flex-col gap-4 p-0 sm:gap-4.5">
          {list.map((s) => (
            <li key={s.id}>
              <AdminSeriesBanner series={s} game={games.find((g) => g.id === s.gameId)?.name ?? null} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Fact({ value, label, warn }: { value: string | number; label: string; warn?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-[10px] bg-ink/85 px-2.5 py-0.5 font-heading text-base text-subtle sm:px-3 sm:py-1 sm:text-lg">
      <span className={cn("text-[1.375rem] leading-none sm:text-[1.625rem]", warn ? "text-warning" : "text-white")}>{value}</span>
      {label}
    </span>
  );
}

function AdminSeriesBanner({ series, game }: { series: AdminSeries; game: string | null }) {
  const look = SCENE_LOOK[series.scene];
  const desktop = useMediaQuery("(min-width: 40rem)");
  const [width, height] = (desktop ? BANNER_SIZE : PHONE_BANNER_SIZE)[series.scene];
  const draft = series.state === "draft";
  const ready = series.checklist.filter((item) => item.done).length;
  return (
    <Link
      to="/admin/series/$id"
      params={{ id: series.id }}
      className={cn(
        liftCardClass,
        "relative flex h-37.5 gap-3 overflow-hidden px-4 py-3.5 text-white sm:px-7.5 sm:py-5",
        draft ? "border-dashed border-cell-hi bg-ink" : look.ground,
      )}
    >
      <SceneArt scene={series.scene} width={width} height={height} className={cn(draft && "opacity-35")} />
      <span className="relative flex min-w-0 flex-1 flex-col items-start justify-between gap-2">
        <span className={cn("max-w-full truncate font-heading text-[3.25rem] leading-[0.85] sm:text-6xl", look.title)}>{series.name}</span>
        <span className={cn("max-w-full truncate rounded-md px-2.5 py-0.5 text-[0.9375rem] font-extrabold sm:px-3 sm:text-[1.0625rem]", game ? look.chip : "bg-ink/85 text-subtle")}>
          {game ?? "No game yet"}
        </span>
      </span>
      <span className="relative flex flex-none flex-col items-end justify-between gap-2">
        <span className={cn("rounded-md border-3 border-ink px-2.5 font-heading text-xl sm:px-3.5 sm:text-2xl", STATE_CHIP[series.state])}>{STATE_NAMES[series.state]}</span>
        <span className="flex gap-2 max-sm:hidden">
          <Fact value={series.playerIds.length} label="players" />
          <Fact value={series.milestones.length} label="milestones" />
          {draft ? <Fact value={`${ready}/${series.checklist.length}`} label="ready to start" warn /> : <Fact value={series.snapshots} label="snapshots" />}
        </span>
        {draft && (
          <span className="sm:hidden">
            <Fact value={`${ready}/${series.checklist.length}`} label="ready" warn />
          </span>
        )}
      </span>
    </Link>
  );
}

function NewSeries({ next }: { next: number }) {
  const navigate = useNavigate();
  const [name, setName] = useState(`Series ${next}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api("/admin/series", adminSeries, { body: { number: next, name } });
      await navigate({ to: "/admin/series/$id", params: { id: created.id } });
    } catch (caught) {
      setError(message(caught));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border-3 bg-card px-4 pt-3.5 pb-4 sm:flex-row sm:items-end sm:gap-3.5 sm:px-5 sm:pt-4 sm:pb-4.5">
      <h2 className="m-0 font-heading text-[1.75rem] leading-none font-normal sm:mr-1.5 sm:self-center sm:text-3xl">New series</h2>
      <div className="flex gap-3 sm:contents">
        <div className={cn(formLabelClass, "w-21 flex-none sm:w-27.5")}>
          Number
          <span className={cn(formFieldClass, "flex items-center bg-box text-muted-foreground")}>{next}</span>
        </div>
        <label className={cn(formLabelClass, "flex-1")}>
          Name
          <input name="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={formFieldClass} />
        </label>
      </div>
      <button type="submit" disabled={busy} className={buttonVariants({ variant: "go", className: "min-h-11.5 px-5 text-[1.625rem]" })}>
        <PixelIcon name="plus" className="size-3.5" />
        Create draft
      </button>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive sm:self-center">
          {error}
        </p>
      )}
    </form>
  );
}
