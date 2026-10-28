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
import { messages, type Lang } from "../../shared/i18n";
import { MOVE_RULE_LABELS, MOVE_RULES } from "../../shared/pool";
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

const t = messages({
  en: {
    marks: { none: "Checkpoint", round: "Round", tournament: "Tournament" },
    ingestion: { manual: "Manual", automatic: "Automatic" },
    ingestionNotes: { manual: "Players upload their own saves from the series page.", automatic: "Saves are read in without an upload." },
    failed: "Something went wrong",
    edit: (name: string) => `Edit ${name}`,
    series: "Series",
    number: "Number",
    name: "Name",
    game: "Game",
    noGame: "No game",
    noZip: (name: string) => `${name} (no zip)`,
    arrive: "Snapshots arrive",
    scene: "Scene",
    players: "Players",
    of: (picked: number, all: number) => `${picked} of ${all}`,
    nobodyAllowed: "Nobody is allowed yet",
    pool: "Default pool",
    poolNote: "A new team from this series' snapshots starts with this pool; its owner can change it.",
    moves: "Moves",
    movesNote: "Which of a snapshot Pokémon's moves its team may pick: known only, or with its learnset up to its level, up to Lv 50 or at any level, and its bag TMs.",
    saveAndStart: "Save and start",
    beforeStart: "Before it starts",
    running: "Running",
    finished: "Finished",
    checklist: "Checklist",
    done: "Done",
    missing: "Missing",
    runningNote: "Players, milestones and rules can still change. The game, scene and pool stay as they started.",
    finishedNote: "Only the rules can still change.",
    finishForGood: (name: string) => `Finish ${name} for good`,
    finishSeries: "Finish series",
    startNote: "Starting saves first, then opens the series to its players. Only one series runs at a time.",
    save: "Save",
    saved: "Saved",
    saveRules: "Save rules",
    start: "Start",
    deleteForGood: (name: string) => `Delete ${name} for good`,
    deleteDraft: "Delete draft",
    previewLabel: "How the series page header will look",
    preview: "Preview of the series page header",
    milestones: "Milestones",
    track: "The track as it shows on the series page",
    milestone: (n: number) => `Milestone ${n}`,
    milestoneKind: (n: number) => `Milestone ${n} kind`,
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    addMilestone: "Add milestone",
    rules: "Rules",
    copyFrom: "Copy rules from",
    copy: "Copy",
    rulesLabel: "Rules in Markdown",
    rulesNote: "Markdown, with tables. Headings become the rules' contents. Readers see their language's rules, or the other language's while theirs are empty.",
    rulesLanguage: "Rules language",
  },
  es: {
    marks: { none: "Control", round: "Ronda", tournament: "Torneo" },
    ingestion: { manual: "Manual", automatic: "Automática" },
    ingestionNotes: { manual: "Los jugadores suben sus partidas desde la página de la serie.", automatic: "Las partidas se leen sin subirlas." },
    failed: "Algo ha fallado",
    edit: (name: string) => `Editar ${name}`,
    series: "Serie",
    number: "Número",
    name: "Nombre",
    game: "Juego",
    noGame: "Sin juego",
    noZip: (name: string) => `${name} (sin zip)`,
    arrive: "Las capturas llegan",
    scene: "Escena",
    players: "Jugadores",
    of: (picked: number, all: number) => `${picked} de ${all}`,
    nobodyAllowed: "Aún no hay nadie admitido",
    pool: "Reserva por defecto",
    poolNote: "Un equipo nuevo con capturas de esta serie empieza con esta reserva; su dueño puede cambiarla.",
    moves: "Movimientos",
    movesNote: "Qué movimientos de un Pokémon de una captura puede elegir su equipo: solo los que conoce, o también su lista de aprendizaje hasta su nivel, hasta el Nv. 50 o a cualquier nivel, y las MT de su mochila.",
    saveAndStart: "Guardar y empezar",
    beforeStart: "Antes de empezar",
    running: "En curso",
    finished: "Terminada",
    checklist: "Lista de comprobación",
    done: "Hecho",
    missing: "Falta",
    runningNote: "Los jugadores, los hitos y las reglas aún pueden cambiar. El juego, la escena y la reserva se quedan como empezaron.",
    finishedNote: "Solo las reglas pueden cambiar aún.",
    finishForGood: (name: string) => `Terminar ${name} para siempre`,
    finishSeries: "Terminar serie",
    startNote: "Empezar primero guarda y luego abre la serie a sus jugadores. Solo puede haber una serie en curso a la vez.",
    save: "Guardar",
    saved: "Guardado",
    saveRules: "Guardar reglas",
    start: "Empezar",
    deleteForGood: (name: string) => `Borrar ${name} para siempre`,
    deleteDraft: "Borrar borrador",
    previewLabel: "Cómo se verá la cabecera de la página de la serie",
    preview: "Vista previa de la cabecera de la serie",
    milestones: "Hitos",
    track: "El recorrido tal como se ve en la página de la serie",
    milestone: (n: number) => `Hito ${n}`,
    milestoneKind: (n: number) => `Tipo del hito ${n}`,
    moveUp: "Subir",
    moveDown: "Bajar",
    remove: "Quitar",
    addMilestone: "Añadir hito",
    rules: "Reglas",
    copyFrom: "Copiar reglas de",
    copy: "Copiar",
    rulesLabel: "Reglas en Markdown",
    rulesNote: "Markdown, con tablas. Los encabezados forman el índice de las reglas. Cada lector ve las reglas de su idioma, o las del otro mientras las suyas estén vacías.",
    rulesLanguage: "Idioma de las reglas",
  },
});

const MARK_NAMES: Record<MilestoneMark, string> = t.marks;

const MARK_ON: Record<MilestoneMark, string> = { none: "bg-cell text-white", round: "bg-round text-white", tournament: "bg-yellow text-ink" };

const INGESTION_NAMES: Record<SeriesInput["ingestion"], string> = t.ingestion;

const INGESTION_NOTES: Record<SeriesInput["ingestion"], string> = t.ingestionNotes;

const THUMB_SIZE: Record<Scene, [number, number]> = { night: [160, 40], route: [160, 55] };

const sectionClass = "flex min-w-0 flex-col gap-3.5 rounded-2xl border-3 bg-card p-4 sm:px-6 sm:pt-5 sm:pb-6";

const headingClass = "m-0 font-heading text-[1.75rem] leading-none font-normal sm:text-[2.125rem]";

type Draft = Omit<SeriesInput, "number">;

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

function draftOf(series: AdminSeries): Draft {
  return {
    name: series.name,
    gameId: series.gameId,
    scene: series.scene,
    ingestion: series.ingestion,
    rules: series.rules,
    rulesEs: series.rulesEs,
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
  const checklist = startChecklist({ rules: draft.rules, rulesEs: draft.rulesEs, gameHasFile: !!chosen?.fileName, milestones: draft.milestones.length, otherRunning: series.otherRunning });
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
        ? api(`/admin/series/${series.id}/rules`, adminSeries, { method: "PUT", body: { rules: draft.rules, rulesEs: draft.rulesEs } })
            .then(() => api(`/admin/series/${series.id}/players`, adminSeries, { method: "PUT", body: { playerIds: draft.playerIds } }))
            .then(() => api(`/admin/series/${series.id}/milestones`, adminSeries, { method: "PUT", body: { milestones: draft.milestones } }))
        : api(`/admin/series/${series.id}/rules`, adminSeries, { method: "PUT", body: { rules: draft.rules, rulesEs: draft.rulesEs } });

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
      <h1 className="sr-only">{t.edit(series.name)}</h1>
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
              {t.series}
            </h2>
            <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3.5">
              <div className={formLabelClass}>
                {t.number}
                <span className={cn(formFieldClass, "flex items-center bg-box text-muted-foreground")}>{series.number}</span>
              </div>
              <label className={formLabelClass}>
                {t.name}
                <input required maxLength={100} disabled={!editable} value={draft.name} onChange={(event) => change({ name: event.target.value })} className={formFieldClass} />
              </label>
              <label className={cn(formLabelClass, "col-span-2 sm:col-span-1")}>
                {t.game}
                <SelectField
                  label={t.game}
                  disabled={!editable}
                  value={draft.gameId ?? ""}
                  onChange={(value) => change({ gameId: value || null })}
                  all={t.noGame}
                  options={games.map((g) => ({ value: g.id, label: g.fileName ? g.name : t.noZip(g.name) }))}
                  className="min-h-11.5 w-full justify-between"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="flex flex-col gap-1.5">
                <span id="ingestion-label" className="font-heading text-xl text-muted-foreground">
                  {t.arrive}
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
                  {t.scene}
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
                {t.players}
              </h2>
              <span className="font-heading text-xl text-muted-foreground sm:text-[1.375rem]">
                {t.of(draft.playerIds.length, pickable.length)}
              </span>
            </div>
            {pickable.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">{t.nobodyAllowed}</p>
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
                {t.pool}
              </h2>
              <span className="text-[0.8125rem] text-muted-foreground">{t.poolNote}</span>
            </div>
            <PoolBar filters={draft.pool} onChange={editable ? (pool) => change({ pool }) : undefined} />
            <div className="flex flex-col gap-1.5">
              <span id="moves-label" className="font-heading text-xl text-muted-foreground">
                {t.moves}
              </span>
              <Segmented
                labelledBy="moves-label"
                size="lg"
                options={MOVE_RULES.map((rule) => ({ value: rule, label: MOVE_RULE_LABELS[rule], disabled: !editable && rule !== draft.pool.moves }))}
                value={draft.pool.moves}
                onChange={(moves) => editable && change({ pool: { ...draft.pool, moves } })}
                className="self-stretch sm:self-start"
              />
              <span className="text-[0.8125rem] text-muted-foreground">{t.movesNote}</span>
            </div>
          </section>

          <RulesEditor rules={draft.rules} rulesEs={draft.rulesEs} others={others} onChange={change} />
        </div>

        <aside aria-label={t.saveAndStart} className="flex flex-col gap-4 max-lg:order-first lg:sticky lg:top-6 lg:w-90 lg:flex-none">
          <section aria-labelledby="series-state" className={cn(sectionClass, "gap-3 sm:px-5.5 sm:pt-5 sm:pb-5.5", running && "border-primary")}>
            <div className="flex items-baseline gap-3">
              <h2 id="series-state" className={cn(headingClass, "flex-1 sm:text-[2rem]")}>
                {editable ? t.beforeStart : running ? t.running : t.finished}
              </h2>
              {editable && (
                <span className="font-heading text-xl text-warning">
                  {t.of(checklist.filter((item) => item.done).length, checklist.length)}
                </span>
              )}
            </div>
            {editable && (
              <ul aria-label={t.checklist} className="m-0 flex list-none flex-col gap-1.5 p-0 sm:gap-2">
                {checklist.map((item) => (
                  <li key={item.label} className={cn("flex min-h-9.5 items-center gap-3 rounded-[10px] px-3", item.done ? "bg-box" : "bg-destructive/10")}>
                    <span
                      role="img"
                      aria-label={item.done ? t.done : t.missing}
                      className={cn("grid size-6 flex-none place-items-center rounded-md text-ink", item.done ? "bg-green" : "bg-destructive")}
                    >
                      <PixelIcon name={item.done ? "check" : "cross"} className={item.done ? "size-3" : "size-2.5"} />
                    </span>
                    <span className={cn("text-[0.9375rem] font-bold", item.done ? "text-foreground" : "text-stat-up")}>{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
            {running && <p className="m-0 text-[0.9375rem] text-subtle">{t.runningNote}</p>}
            {finished && <p className="m-0 text-[0.9375rem] text-subtle">{t.finishedNote}</p>}
            {running &&
              (confirming === "finish" ? (
                <button type="button" disabled={busy} onClick={() => void run(finish)} className={buttonVariants({ variant: "go", className: "min-h-13 text-[1.625rem]" })}>
                  {t.finishForGood(series.name)}
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirming("finish")} className={buttonVariants({ className: "min-h-13 text-[1.625rem]" })}>
                  {t.finishSeries}
                </button>
              ))}
            {editable && <span className="text-[0.8125rem] text-muted-foreground max-lg:hidden">{t.startNote}</span>}
          </section>

          <section
            aria-label={t.save}
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
                    {t.saved}
                  </span>
                ) : finished ? (
                  t.saveRules
                ) : (
                  t.save
                )}
              </button>
              {editable && (
                <button type="button" disabled={busy || !ready} onClick={() => void run(start)} className={buttonVariants({ variant: "go", className: "min-h-12.5 flex-[1.4] text-[1.625rem]" })}>
                  {t.start}
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
                {confirming === "delete" ? t.deleteForGood(series.name) : t.deleteDraft}
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
          {confirming === "delete" ? t.deleteForGood(series.name) : t.deleteDraft}
        </button>
      )}
    </main>
  );
}

function Preview({ name, scene, game, state }: { name: string; scene: Scene; game: string | null; state: AdminSeries["state"] }) {
  const look = SCENE_LOOK[scene];
  const desktop = useMediaQuery("(min-width: 40rem)");
  return (
    <section aria-label={t.previewLabel} className={cn("relative flex h-37.5 gap-3 overflow-hidden rounded-2xl border-4 border-cell p-3.5 sm:h-42.5 sm:px-8 sm:py-6", look.ground)}>
      <SceneArt scene={scene} width={desktop ? 338 : 110} height={desktop ? (scene === "night" ? 40 : 55) : 55} />
      <span className="relative flex min-w-0 flex-1 flex-col items-start justify-between gap-2">
        <span className={cn("max-w-full truncate font-heading text-[3.5rem] leading-[0.85] text-white sm:text-[5rem]", look.title)}>{name}</span>
        {game && <span className={cn("max-w-full truncate rounded-md px-2.5 py-0.5 text-[0.9375rem] font-extrabold max-sm:hidden sm:px-3 sm:text-[1.0625rem]", look.chip)}>{game}</span>}
      </span>
      <span className="relative flex flex-none flex-col items-end justify-between">
        <span className={cn("rounded-md border-3 border-ink px-2.5 font-heading text-xl sm:px-3.5 sm:text-2xl", STATE_CHIP[state])}>{STATE_NAMES[state]}</span>
        <span className="rounded-lg bg-ink/85 px-3 py-0.5 font-heading text-lg text-subtle max-sm:hidden">{t.preview}</span>
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
          {t.milestones}
        </h2>
        <span className="font-heading text-xl text-muted-foreground sm:text-[1.375rem]">{milestones.length}</span>
        <span className="ml-auto text-[0.8125rem] text-muted-foreground max-sm:hidden">{t.track}</span>
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
                aria-label={t.milestone(index + 1)}
                required
                maxLength={40}
                disabled={locked}
                value={m.name}
                onChange={(event) => set(index, { name: event.target.value })}
                className={cn(formFieldClass, "h-10 min-w-0 flex-1 rounded-[9px] border-2 text-[0.9375rem] sm:text-base")}
              />
              {!locked && (
                <span className="flex flex-none sm:order-last">
                  <MoveButton label={t.moveUp} icon="up" disabled={index === 0} onClick={() => move(index, -1)} />
                  <MoveButton label={t.moveDown} icon="down" disabled={index === milestones.length - 1} onClick={() => move(index, 1)} />
                  <button
                    type="button"
                    aria-label={t.remove}
                    title={t.remove}
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
              aria-label={t.milestoneKind(index + 1)}
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
          {t.addMilestone}
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

function RulesEditor({
  rules,
  rulesEs,
  others,
  onChange,
}: {
  rules: string;
  rulesEs: string;
  others: AdminSeries[];
  onChange: (next: { rules?: string; rulesEs?: string }) => void;
}) {
  const sources = others.filter((s) => s.rules.trim() !== "" || s.rulesEs.trim() !== "");
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState<Lang>("es");
  const picked = sources.find((s) => s.id === source) ?? sources[0];

  return (
    <section aria-labelledby="series-rules" className={sectionClass}>
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <h2 id="series-rules" className={cn(headingClass, "flex-1")}>
          {t.rules}
        </h2>
        {sources.length > 0 && (
          <div className="flex w-full gap-2 sm:w-auto sm:gap-2.5">
            <SelectField label={t.copyFrom} size="sm" value={picked?.id ?? ""} onChange={setSource} options={sources.map((s) => ({ value: s.id, label: s.name }))} className="max-sm:flex-1" />
            <button type="button" disabled={!picked} onClick={() => picked && onChange({ rules: picked.rules, rulesEs: picked.rulesEs })} className={buttonVariants({ className: "min-h-10.5 px-4 text-[1.375rem]" })}>
              {t.copy}
            </button>
          </div>
        )}
      </div>
      <Segmented
        label={t.rulesLanguage}
        options={[
          { value: "es", label: "Español" },
          { value: "en", label: "English" },
        ]}
        value={language}
        onChange={setLanguage}
        className="self-start"
      />
      <textarea
        aria-label={t.rulesLabel}
        lang={language}
        value={language === "es" ? rulesEs : rules}
        onChange={(event) => onChange(language === "es" ? { rulesEs: event.target.value } : { rules: event.target.value })}
        rows={14}
        className="min-h-60 resize-y rounded-xl border-3 bg-ink px-3 py-3 font-mono text-[0.8125rem] leading-relaxed text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-ring/30 sm:min-h-75 sm:px-4 sm:py-3.5 sm:text-sm"
      />
      <span className="text-[0.8125rem] text-muted-foreground">{t.rulesNote}</span>
    </section>
  );
}
