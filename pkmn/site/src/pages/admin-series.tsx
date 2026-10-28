import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { formFieldClass, formLabelClass, Segmented } from "@/components/controls";
import { adminPage, AdminSeriesFrame } from "@/components/page-frames";
import { PixelIcon } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { PoolBar } from "@/components/pool-bar";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { SelectField } from "@/components/select-field";
import { buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { STATE_CHIP, STATE_NAMES } from "@/pages/admin-series-list";
import { type Game, gameList } from "../../shared/games";
import { type Player, playerList } from "../../shared/players";
import {
  type AdminSeries,
  adminSeries,
  adminSeriesList,
  INGESTION_MODES,
  MILESTONE_MARKS,
  type MilestoneMark,
  type Scene,
  SCENE_NAMES,
  SCENES,
  type SeriesInput,
  seriesDeleted,
  startChecklist,
} from "../../shared/series";

const MARK_NAMES: Record<MilestoneMark, string> = { none: "Checkpoint", round: "Round", tournament: "Tournament" };

const MARK_ON: Record<MilestoneMark, string> = { none: "bg-cell text-white", round: "bg-round text-white", tournament: "bg-yellow text-ink" };

const INGESTION_NAMES: Record<SeriesInput["ingestion"], string> = { manual: "Manual", automatic: "Automatic" };

const INGESTION_NOTES: Record<SeriesInput["ingestion"], string> = {
  manual: "Players upload their own saves from the series page.",
  automatic: "Saves are read in without an upload.",
};

const THUMB_SIZE: Record<Scene, [number, number]> = { night: [160, 40], route: [160, 55] };

const sectionClass = "flex min-w-0 flex-col gap-3.5 rounded-2xl border-3 bg-card p-4 sm:px-6 sm:pt-5 sm:pb-6";

const headingClass = "m-0 font-heading text-[1.75rem] leading-none font-normal sm:text-[2.125rem]";

type Draft = Omit<SeriesInput, "number">;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function draftOf(series: AdminSeries): Draft {
  return {
    name: series.name,
    gameId: series.gameId,
    scene: series.scene,
    ingestion: series.ingestion,
    rules: series.rules,
    pool: series.pool,
    playerIds: series.playerIds,
    milestones: series.milestones,
  };
}

function shortName(name: string): string {
  const number = /(\d+)$/.exec(name);
  if (number) return number[1]!;
  return (name.split(/[\s-]+/).at(-1) ?? name).charAt(0).toUpperCase();
}

function Trophy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("fill-yellow", className)}>
      <path d="M7 3h10v5a5 5 0 0 1-10 0z" />
      <path d="M10 13h4v4h3v4H7v-4h3z" />
    </svg>
  );
}

type Loaded = { series: AdminSeries; games: Game[]; players: Player[]; others: AdminSeries[] };

export function AdminSeriesPage() {
  const { id } = useParams({ from: "/admin/series/$id" });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(null);
    Promise.all([api(`/admin/series/${id}`, adminSeries), api("/games", gameList), api("/players", playerList), api("/admin/series", adminSeriesList)]).then(
      ([series, games, players, all]) => setLoaded({ series, games, players, others: all.filter((s) => s.id !== series.id) }),
      (caught: unknown) => setError(message(caught)),
    );
  }, [id]);

  if (error && !loaded) {
    return (
      <main className={adminPage}>
        <AdminNav />
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!loaded) return <AdminSeriesFrame />;
  return <SeriesForm key={loaded.series.id} {...loaded} />;
}

function SeriesForm({ series: first, games, players, others }: Loaded) {
  const navigate = useNavigate();
  const [series, setSeries] = useState(first);
  const [draft, setDraft] = useState<Draft>(() => draftOf(first));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "finish" | null>(null);

  const editable = series.state === "draft";
  const running = series.state === "running";
  const finished = series.state === "finished";
  const change = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  const chosen = games.find((g) => g.id === draft.gameId);
  const checklist = startChecklist({ rules: draft.rules, gameHasFile: !!chosen?.fileName, milestones: draft.milestones.length, otherRunning: series.otherRunning });
  const ready = checklist.every((item) => item.done);

  async function run(action: () => Promise<AdminSeries | undefined>) {
    setBusy(true);
    setError(null);
    setConfirming(null);
    try {
      const updated = await action();
      if (updated) {
        setSeries(updated);
        setDraft(draftOf(updated));
        setSaved(true);
      }
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  }

  const save = () =>
    editable
      ? api(`/admin/series/${series.id}`, adminSeries, { method: "PUT", body: { ...draft, number: series.number } satisfies SeriesInput })
      : running
        ? api(`/admin/series/${series.id}/rules`, adminSeries, { method: "PUT", body: { rules: draft.rules } })
            .then(() => api(`/admin/series/${series.id}/players`, adminSeries, { method: "PUT", body: { playerIds: draft.playerIds } }))
            .then(() => api(`/admin/series/${series.id}/milestones`, adminSeries, { method: "PUT", body: { milestones: draft.milestones } }))
        : api(`/admin/series/${series.id}/rules`, adminSeries, { method: "PUT", body: { rules: draft.rules } });

  const start = async () => {
    await save();
    return api(`/admin/series/${series.id}/start`, adminSeries, { method: "POST", body: {} });
  };

  const finish = () => api(`/admin/series/${series.id}/finish`, adminSeries, { method: "POST", body: {} });

  const remove = async () => {
    await api(`/admin/series/${series.id}`, seriesDeleted, { method: "DELETE" });
    await navigate({ to: "/admin/series" });
    return undefined;
  };

  const pickable = players.filter((p) => p.allowed || draft.playerIds.includes(p.id));

  return (
    <main className={cn(adminPage, "max-lg:pb-32")}>
      <h1 className="sr-only">Edit {series.name}</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4.5">
        <AdminNav />
        <span className="min-w-0 truncate font-heading text-2xl text-white max-sm:hidden sm:text-[1.625rem]">
          <span aria-hidden="true" className="mr-4 text-faint">
            ›
          </span>
          {series.name}
        </span>
      </div>

      <Preview name={draft.name || series.name} scene={draft.scene} game={chosen?.name ?? null} state={series.state} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5">
          <section aria-labelledby="series-details" className={sectionClass}>
            <h2 id="series-details" className={headingClass}>
              Series
            </h2>
            <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3.5">
              <div className={formLabelClass}>
                Number
                <span className={cn(formFieldClass, "flex items-center bg-box text-muted-foreground")}>{series.number}</span>
              </div>
              <label className={formLabelClass}>
                Name
                <input required maxLength={100} disabled={!editable} value={draft.name} onChange={(event) => change({ name: event.target.value })} className={formFieldClass} />
              </label>
              <label className={cn(formLabelClass, "col-span-2 sm:col-span-1")}>
                Game
                <SelectField
                  label="Game"
                  disabled={!editable}
                  value={draft.gameId ?? ""}
                  onChange={(value) => change({ gameId: value || null })}
                  all="No game"
                  options={games.map((g) => ({ value: g.id, label: g.fileName ? g.name : `${g.name} (no zip)` }))}
                  className="min-h-11.5 w-full justify-between"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="flex flex-col gap-1.5">
                <span id="ingestion-label" className="font-heading text-xl text-muted-foreground">
                  Snapshots arrive
                </span>
                <Segmented
                  labelledBy="ingestion-label"
                  size="lg"
                  options={INGESTION_MODES.map((mode) => ({ value: mode, label: INGESTION_NAMES[mode], disabled: !editable && mode !== draft.ingestion }))}
                  value={draft.ingestion}
                  onChange={(ingestion) => editable && change({ ingestion })}
                  className="self-stretch sm:self-start"
                />
                <span className="text-[0.8125rem] text-muted-foreground">{INGESTION_NOTES[draft.ingestion]}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span id="scene-label" className="font-heading text-xl text-muted-foreground">
                  Scene
                </span>
                <div role="radiogroup" aria-labelledby="scene-label" className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {SCENES.map((scene) => (
                    <button
                      key={scene}
                      type="button"
                      role="radio"
                      aria-checked={draft.scene === scene}
                      disabled={!editable}
                      onClick={() => change({ scene })}
                      className={cn(
                        "relative h-17.5 cursor-pointer overflow-hidden rounded-xl border-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-55 sm:h-20.5",
                        SCENE_LOOK[scene].ground,
                        draft.scene === scene ? "border-primary" : "border-border enabled:hover:border-primary",
                      )}
                    >
                      <SceneArt scene={scene} width={THUMB_SIZE[scene][0]} height={THUMB_SIZE[scene][1]} />
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-ink/90 px-2 font-heading text-lg text-white sm:bottom-2 sm:left-2.5 sm:px-2.5 sm:text-xl">
                        {SCENE_NAMES[scene]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="series-players" className={sectionClass}>
            <div className="flex items-baseline gap-3">
              <h2 id="series-players" className={headingClass}>
                Players
              </h2>
              <span className="font-heading text-xl text-muted-foreground sm:text-[1.375rem]">
                {draft.playerIds.length} of {pickable.length}
              </span>
            </div>
            {pickable.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">Nobody is allowed yet</p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:gap-2.5 lg:grid-cols-4">
                {pickable.map((p) => {
                  const picked = draft.playerIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-pressed={picked}
                        disabled={finished}
                        onClick={() => change({ playerIds: picked ? draft.playerIds.filter((pid) => pid !== p.id) : [...draft.playerIds, p.id] })}
                        className={cn(
                          "flex min-h-13 w-full cursor-pointer items-center gap-2.5 rounded-xl border-3 px-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-55 sm:min-h-15 sm:gap-3 sm:px-3",
                          picked ? "border-primary bg-accent" : "border-cell bg-box enabled:hover:border-primary",
                        )}
                      >
                        <PlayerBadge name={p.name} colour={playerColour(p.name)} size="xs" />
                        <span className="min-w-0 flex-1 truncate font-heading text-[1.375rem] sm:text-[1.625rem]">{p.name}</span>
                        <span
                          aria-hidden="true"
                          className={cn("grid size-6.5 flex-none place-items-center rounded-[7px] border-3 text-ink max-sm:hidden", picked ? "border-primary bg-primary" : "border-cell-hi bg-ink")}
                        >
                          {picked && <PixelIcon name="check" className="size-3" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Milestones milestones={draft.milestones} locked={finished} onChange={(milestones) => change({ milestones })} />

          <section aria-labelledby="series-pool" className={sectionClass}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="series-pool" className={headingClass}>
                Default pool
              </h2>
              <span className="text-[0.8125rem] text-muted-foreground">A new team from this series' snapshots starts with this pool; its owner can change it.</span>
            </div>
            <PoolBar filters={draft.pool} onChange={editable ? (pool) => change({ pool }) : undefined} />
          </section>

          <RulesEditor rules={draft.rules} others={others} onChange={(rules) => change({ rules })} />
        </div>

        <aside aria-label="Save and start" className="flex flex-col gap-4 max-lg:order-first lg:sticky lg:top-6 lg:w-90 lg:flex-none">
          <section aria-labelledby="series-state" className={cn(sectionClass, "gap-3 sm:px-5.5 sm:pt-5 sm:pb-5.5", running && "border-primary")}>
            <div className="flex items-baseline gap-3">
              <h2 id="series-state" className={cn(headingClass, "flex-1 sm:text-[2rem]")}>
                {editable ? "Before it starts" : running ? "Running" : "Finished"}
              </h2>
              {editable && (
                <span className="font-heading text-xl text-warning">
                  {checklist.filter((item) => item.done).length} of {checklist.length}
                </span>
              )}
            </div>
            {editable && (
              <ul aria-label="Checklist" className="m-0 flex list-none flex-col gap-1.5 p-0 sm:gap-2">
                {checklist.map((item) => (
                  <li key={item.label} className={cn("flex min-h-9.5 items-center gap-3 rounded-[10px] px-3", item.done ? "bg-box" : "bg-destructive/10")}>
                    <span
                      role="img"
                      aria-label={item.done ? "Done" : "Missing"}
                      className={cn("grid size-6 flex-none place-items-center rounded-md text-ink", item.done ? "bg-green" : "bg-destructive")}
                    >
                      <PixelIcon name={item.done ? "check" : "cross"} className={item.done ? "size-3" : "size-2.5"} />
                    </span>
                    <span className={cn("text-[0.9375rem] font-bold", item.done ? "text-foreground" : "text-stat-up")}>{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
            {running && <p className="m-0 text-[0.9375rem] text-subtle">Players, milestones and rules can still change. The game, scene and pool stay as they started.</p>}
            {finished && <p className="m-0 text-[0.9375rem] text-subtle">Only the rules can still change.</p>}
            {running &&
              (confirming === "finish" ? (
                <button type="button" disabled={busy} onClick={() => void run(finish)} className={buttonVariants({ variant: "go", className: "min-h-13 text-[1.625rem]" })}>
                  Finish {series.name} for good
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirming("finish")} className={buttonVariants({ className: "min-h-13 text-[1.625rem]" })}>
                  Finish series
                </button>
              ))}
            {editable && <span className="text-[0.8125rem] text-muted-foreground max-lg:hidden">Starting saves first, then opens the series to its players. Only one series runs at a time.</span>}
          </section>

          <section
            aria-label="Save"
            className="flex flex-col gap-3 rounded-2xl border-3 bg-card p-4 sm:px-5.5 sm:py-4.5 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:bg-ink max-lg:px-4 max-lg:pt-3 max-lg:pb-4"
          >
            {error && (
              <p role="alert" className="m-0 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex items-center gap-2.5">
              <button type="button" disabled={busy} onClick={() => void run(save)} className={buttonVariants({ className: "min-h-12.5 flex-1 text-[1.625rem]" })}>
                {saved && !busy ? (
                  <span role="status" className="flex items-center gap-2 text-green">
                    <PixelIcon name="check" className="size-3.5" />
                    Saved
                  </span>
                ) : finished ? (
                  "Save rules"
                ) : (
                  "Save"
                )}
              </button>
              {editable && (
                <button type="button" disabled={busy || !ready} onClick={() => void run(start)} className={buttonVariants({ variant: "go", className: "min-h-12.5 flex-[1.4] text-[1.625rem]" })}>
                  Start
                </button>
              )}
            </div>
            {editable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => (confirming === "delete" ? void run(remove) : setConfirming("delete"))}
                className={cn(
                  "min-h-11 cursor-pointer rounded-[10px] border-2 font-heading text-[1.375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 max-lg:hidden",
                  confirming === "delete" ? "border-destructive bg-destructive text-ink" : "border-destructive/50 bg-transparent text-destructive hover:bg-destructive/15",
                )}
              >
                {confirming === "delete" ? `Delete ${series.name} for good` : "Delete draft"}
              </button>
            )}
          </section>
        </aside>
      </div>

      {editable && (
        <button
          type="button"
          disabled={busy}
          onClick={() => (confirming === "delete" ? void run(remove) : setConfirming("delete"))}
          className={cn(
            "min-h-11.5 cursor-pointer rounded-[10px] border-2 font-heading text-[1.375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 lg:hidden",
            confirming === "delete" ? "border-destructive bg-destructive text-ink" : "border-destructive/50 bg-transparent text-destructive hover:bg-destructive/15",
          )}
        >
          {confirming === "delete" ? `Delete ${series.name} for good` : "Delete draft"}
        </button>
      )}
    </main>
  );
}

function Preview({ name, scene, game, state }: { name: string; scene: Scene; game: string | null; state: AdminSeries["state"] }) {
  const look = SCENE_LOOK[scene];
  const desktop = useMediaQuery("(min-width: 40rem)");
  return (
    <section aria-label="How the series page header will look" className={cn("relative flex h-37.5 gap-3 overflow-hidden rounded-2xl border-4 border-cell p-3.5 sm:h-42.5 sm:px-8 sm:py-6", look.ground)}>
      <SceneArt scene={scene} width={desktop ? 338 : 110} height={desktop ? (scene === "night" ? 40 : 55) : 55} />
      <span className="relative flex min-w-0 flex-1 flex-col items-start justify-between gap-2">
        <span className={cn("max-w-full truncate font-heading text-[3.5rem] leading-[0.85] text-white sm:text-[5rem]", look.title)}>{name}</span>
        {game && <span className={cn("max-w-full truncate rounded-md px-2.5 py-0.5 text-[0.9375rem] font-extrabold max-sm:hidden sm:px-3 sm:text-[1.0625rem]", look.chip)}>{game}</span>}
      </span>
      <span className="relative flex flex-none flex-col items-end justify-between">
        <span className={cn("rounded-md border-3 border-ink px-2.5 font-heading text-xl sm:px-3.5 sm:text-2xl", STATE_CHIP[state])}>{STATE_NAMES[state]}</span>
        <span className="rounded-lg bg-ink/85 px-3 py-0.5 font-heading text-lg text-subtle max-sm:hidden">Preview of the series page header</span>
      </span>
    </section>
  );
}

function Milestones({ milestones, locked, onChange }: { milestones: Draft["milestones"]; locked: boolean; onChange: (milestones: Draft["milestones"]) => void }) {
  let round = 0;
  const heads = milestones.map((m) => ({ ...m, round: m.mark === "round" ? ++round : 0 }));
  const columns = `repeat(${Math.max(milestones.length, 1)}, minmax(0, 1fr))`;
  const set = (index: number, patch: Partial<Draft["milestones"][number]>) => onChange(milestones.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  const move = (index: number, by: number) => {
    const list = [...milestones];
    const [taken] = list.splice(index, 1);
    if (taken) list.splice(index + by, 0, taken);
    onChange(list);
  };

  return (
    <section aria-labelledby="series-milestones" className={sectionClass}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="series-milestones" className={headingClass}>
          Milestones
        </h2>
        <span className="font-heading text-xl text-muted-foreground sm:text-[1.375rem]">{milestones.length}</span>
        <span className="ml-auto text-[0.8125rem] text-muted-foreground max-sm:hidden">The track as it shows on the series page</span>
      </div>
      {milestones.length > 0 && (
        <div aria-hidden="true" className="grid overflow-hidden rounded-xl bg-box" style={{ gridTemplateColumns: columns }}>
          {heads.map((m, index) => (
            <span key={m.id ?? `new-${index}`} className={cn("flex flex-col items-center gap-2 pt-2.5 pb-3", m.round > 0 && "bg-round/12")}>
              <span className={cn("flex h-5 items-center font-heading text-lg leading-none whitespace-nowrap sm:text-[1.1875rem]", m.round > 0 ? "text-round-ink" : "text-muted-foreground")}>
                {m.mark === "tournament" ? <Trophy className="size-4" /> : shortName(m.name)}
              </span>
              <span className="relative grid h-6.5 w-full place-items-center max-sm:hidden">
                <span className={cn("absolute inset-x-0 top-2.75 h-1 bg-cell-hi", index === 0 && "left-1/2", index === heads.length - 1 && "right-1/2")} />
                {m.mark === "tournament" ? (
                  <span className="relative grid size-6.5 place-items-center rounded-full border-2 border-trophy-rim bg-trophy">
                    <Trophy className="size-3.5" />
                  </span>
                ) : (
                  <span className={cn("relative rounded-full bg-cell", m.round > 0 ? "size-4.5 ring-3 ring-round" : "size-3 ring-3 ring-cell-hi")} />
                )}
              </span>
            </span>
          ))}
        </div>
      )}
      <ol className="m-0 flex list-none flex-col gap-2 p-0 sm:gap-1.5">
        {milestones.map((m, index) => (
          <li
            key={m.id ?? `new-${index}`}
            className="flex flex-col gap-2 rounded-xl border-2 border-cell bg-box p-2.5 sm:min-h-13.5 sm:flex-row sm:items-center sm:gap-2.5 sm:py-0 sm:pr-2 sm:pl-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
              <span className="w-5 flex-none text-center font-heading text-xl text-faint sm:w-6 sm:text-[1.375rem]">{index + 1}</span>
              <input
                aria-label={`Milestone ${index + 1}`}
                required
                maxLength={40}
                disabled={locked}
                value={m.name}
                onChange={(event) => set(index, { name: event.target.value })}
                className={cn(formFieldClass, "h-10 min-w-0 flex-1 rounded-[9px] border-2 text-[0.9375rem] sm:text-base")}
              />
              {!locked && (
                <span className="flex flex-none sm:order-last">
                  <MoveButton label="Move up" icon="up" disabled={index === 0} onClick={() => move(index, -1)} />
                  <MoveButton label="Move down" icon="down" disabled={index === milestones.length - 1} onClick={() => move(index, 1)} />
                  <button
                    type="button"
                    aria-label="Remove"
                    title="Remove"
                    onClick={() => onChange(milestones.filter((_, i) => i !== index))}
                    className="grid h-10 w-8.5 cursor-pointer place-items-center rounded-lg text-destructive outline-none hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-9"
                  >
                    <PixelIcon name="cross" className="size-3" />
                  </button>
                </span>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label={`Milestone ${index + 1} kind`}
              className="grid flex-none grid-cols-3 gap-0.75 rounded-[10px] border-2 bg-ink p-0.75 sm:flex"
            >
              {MILESTONE_MARKS.map((mark) => (
                <button
                  key={mark}
                  type="button"
                  role="radio"
                  aria-checked={m.mark === mark}
                  disabled={locked}
                  onClick={() => set(index, { mark })}
                  className={cn(
                    "min-h-8.5 cursor-pointer rounded-[7px] px-3 font-heading text-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default sm:min-h-8 sm:text-[1.1875rem]",
                    m.mark === mark ? MARK_ON[mark] : "text-muted-foreground enabled:hover:bg-card enabled:hover:text-white",
                  )}
                >
                  {MARK_NAMES[mark]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {!locked && (
        <button
          type="button"
          onClick={() => onChange([...milestones, { name: "", mark: "none" }])}
          className="flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-xl border-3 border-dashed border-cell-hi font-heading text-[1.375rem] text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-2xl"
        >
          <PixelIcon name="plus" className="size-3.5" />
          Add milestone
        </button>
      )}
    </section>
  );
}

function MoveButton({ label, icon, disabled, onClick }: { label: string; icon: "up" | "down"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-10 w-8.5 cursor-pointer place-items-center rounded-lg text-muted-foreground outline-none enabled:hover:bg-cell enabled:hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-35 sm:size-9"
    >
      <PixelIcon name={icon} className="size-3.5" />
    </button>
  );
}

function RulesEditor({ rules, others, onChange }: { rules: string; others: AdminSeries[]; onChange: (rules: string) => void }) {
  const sources = others.filter((s) => s.rules.trim() !== "");
  const [source, setSource] = useState("");
  const picked = sources.find((s) => s.id === source) ?? sources[0];

  return (
    <section aria-labelledby="series-rules" className={sectionClass}>
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <h2 id="series-rules" className={cn(headingClass, "flex-1")}>
          Rules
        </h2>
        {sources.length > 0 && (
          <div className="flex w-full gap-2 sm:w-auto sm:gap-2.5">
            <SelectField label="Copy rules from" size="sm" value={picked?.id ?? ""} onChange={setSource} options={sources.map((s) => ({ value: s.id, label: s.name }))} className="max-sm:flex-1" />
            <button type="button" disabled={!picked} onClick={() => picked && onChange(picked.rules)} className={buttonVariants({ className: "min-h-10.5 px-4 text-[1.375rem]" })}>
              Copy
            </button>
          </div>
        )}
      </div>
      <textarea
        aria-label="Rules in Markdown"
        value={rules}
        onChange={(event) => onChange(event.target.value)}
        rows={14}
        className="min-h-60 resize-y rounded-xl border-3 bg-ink px-3 py-3 font-mono text-[0.8125rem] leading-relaxed text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-ring/30 sm:min-h-75 sm:px-4 sm:py-3.5 sm:text-sm"
      />
      <span className="text-[0.8125rem] text-muted-foreground">Markdown, with tables. Headings become the rules' contents.</span>
    </section>
  );
}
