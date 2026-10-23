import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClass, fieldClass, Panel, quietIconClass, Segmented } from "@/components/controls";
import { listPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminGate } from "@/pages/admin";
import { STATE_NAMES } from "@/pages/admin-series-list";
import { type Game, gameList } from "../../shared/games";
import { type Player, playerList } from "../../shared/players";
import {
  type AdminSeries,
  adminSeries,
  adminSeriesList,
  INGESTION_MODES,
  MILESTONE_MARKS,
  type MilestoneMark,
  SCENE_NAMES,
  SCENES,
  type SeriesInput,
  seriesDeleted,
  startChecklist,
} from "../../shared/series";

const MARK_NAMES: Record<MilestoneMark, string> = { none: "Milestone", round: "League round", tournament: "Tournament" };

const INGESTION_NAMES: Record<SeriesInput["ingestion"], string> = { manual: "Manual", automatic: "Automatic" };

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type Draft = Omit<SeriesInput, "number"> & { number: string };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function draftOf(series: AdminSeries): Draft {
  return {
    number: String(series.number),
    name: series.name,
    gameId: series.gameId,
    scene: series.scene,
    ingestion: series.ingestion,
    rules: series.rules,
    playerIds: series.playerIds,
    milestones: series.milestones,
  };
}

export function AdminSeriesPage() {
  return (
    <AdminGate>
      <AdminSeriesForm />
    </AdminGate>
  );
}

function AdminSeriesForm() {
  const { id } = useParams({ from: "/admin/series/$id" });
  const navigate = useNavigate();
  const [series, setSeries] = useState<AdminSeries | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [others, setOthers] = useState<AdminSeries[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "finish" | null>(null);

  useEffect(() => {
    Promise.all([
      api(`/admin/series/${id}`, adminSeries),
      api("/games", gameList),
      api("/players", playerList),
      api("/admin/series", adminSeriesList),
    ]).then(
      ([loaded, gameRows, playerRows, all]) => {
        setSeries(loaded);
        setDraft(draftOf(loaded));
        setGames(gameRows);
        setPlayers(playerRows);
        setOthers(all.filter((s) => s.id !== loaded.id));
      },
      (caught: unknown) => setError(message(caught)),
    );
  }, [id]);

  if (!series || !draft) {
    return (
      <main className={cn(listPage, "py-7 sm:py-9")}>
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
      </main>
    );
  }

  const editable = series.state === "draft";
  const change = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };
  const chosen = games.find((g) => g.id === draft.gameId);
  const checklist = startChecklist({
    rules: draft.rules,
    gameHasFile: !!chosen?.fileName,
    players: draft.playerIds.length,
    milestones: draft.milestones.length,
    otherRunning: series.otherRunning,
  });
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
      ? api(`/admin/series/${series.id}`, adminSeries, {
          method: "PUT",
          body: { ...draft, number: Number(draft.number) } satisfies SeriesInput,
        })
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

  const allowed = players.filter((p) => p.allowed || draft.playerIds.includes(p.id));

  return (
    <main className={cn(listPage, "gap-5 py-7 sm:py-9")}>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 flex-1 font-heading text-5xl leading-none sm:text-6xl">{series.name}</h1>
        <span className={cn("font-heading text-2xl", series.state === "running" ? "text-primary" : "text-muted-foreground")}>
          {STATE_NAMES[series.state]}
        </span>
        <Link to="/admin/series" className={buttonClass}>
          Series
        </Link>
      </div>

      <Panel title="Series">
        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Number
            <input
              type="number"
              min={1}
              max={999}
              required
              disabled={!editable}
              value={draft.number}
              onChange={(event) => change({ number: event.target.value })}
              className={cn(fieldClass, focus, "disabled:opacity-60")}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Name
            <input
              required
              maxLength={100}
              disabled={!editable}
              value={draft.name}
              onChange={(event) => change({ name: event.target.value })}
              className={cn(fieldClass, focus, "disabled:opacity-60")}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          Game
          <select
            disabled={!editable}
            value={draft.gameId ?? ""}
            onChange={(event) => change({ gameId: event.target.value || null })}
            className={cn(fieldClass, focus, "cursor-pointer disabled:opacity-60")}
          >
            <option value="">No game</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.fileName ? g.name : `${g.name} (no file)`}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          Ingestion
          <Segmented
            label="Ingestion"
            options={INGESTION_MODES.map((mode) => ({ value: mode, label: INGESTION_NAMES[mode] }))}
            value={draft.ingestion}
            onChange={(ingestion) => editable && change({ ingestion })}
            className="self-start"
          />
        </div>
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          Scene
          <Segmented
            label="Scene"
            options={SCENES.map((scene) => ({ value: scene, label: SCENE_NAMES[scene] }))}
            value={draft.scene}
            onChange={(scene) => editable && change({ scene })}
            className="self-start"
          />
          <div className={cn("relative h-35 overflow-hidden rounded-2xl border-4 border-cell", SCENE_LOOK[draft.scene].ground)}>
            <SceneArt scene={draft.scene} width={338} height={draft.scene === "night" ? 33 : 55} />
            <span className={cn("absolute top-5.5 left-5 font-heading text-5xl leading-[0.8] text-white sm:left-8 sm:text-6xl", SCENE_LOOK[draft.scene].title)}>
              {draft.name}
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="Players" aside={<span className="text-sm text-muted-foreground tabular-nums">{draft.playerIds.length}</span>}>
        {allowed.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">Nobody is allowed yet</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {allowed.map((p) => {
              const picked = draft.playerIds.includes(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border bg-muted px-3 py-2 focus-within:ring-3 focus-within:ring-ring/50",
                      picked && "border-primary",
                      !editable && "cursor-default opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={picked}
                      onChange={() =>
                        change({ playerIds: picked ? draft.playerIds.filter((pid) => pid !== p.id) : [...draft.playerIds, p.id] })
                      }
                      className="size-4 accent-primary"
                    />
                    <PlayerBadge name={p.name} colour={playerColour(p.id)} />
                    <span className="min-w-0 flex-1 truncate font-heading text-2xl">{p.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Milestones" aside={<span className="text-sm text-muted-foreground tabular-nums">{draft.milestones.length}</span>}>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {draft.milestones.map((m, index) => {
            const set = (patch: Partial<typeof m>) =>
              change({ milestones: draft.milestones.map((other, i) => (i === index ? { ...other, ...patch } : other)) });
            const move = (by: number) => {
              const list = [...draft.milestones];
              const [taken] = list.splice(index, 1);
              if (taken) list.splice(index + by, 0, taken);
              change({ milestones: list });
            };
            return (
              <li key={index} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-2.5 py-2">
                <span className="w-6 text-center text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                <input
                  aria-label={`Milestone ${index + 1}`}
                  required
                  maxLength={40}
                  disabled={!editable}
                  value={m.name}
                  onChange={(event) => set({ name: event.target.value })}
                  className={cn(fieldClass, focus, "min-w-32 flex-1 bg-card disabled:opacity-60")}
                />
                <select
                  aria-label={`Milestone ${index + 1} kind`}
                  disabled={!editable}
                  value={m.mark}
                  onChange={(event) => set({ mark: event.target.value as MilestoneMark })}
                  className={cn(fieldClass, focus, "cursor-pointer bg-card disabled:opacity-60")}
                >
                  {MILESTONE_MARKS.map((mark) => (
                    <option key={mark} value={mark}>
                      {MARK_NAMES[mark]}
                    </option>
                  ))}
                </select>
                {editable && (
                  <span className="flex">
                    <button type="button" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => move(-1)} className={quietIconClass}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      title="Move down"
                      disabled={index === draft.milestones.length - 1}
                      onClick={() => move(1)}
                      className={quietIconClass}
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove"
                      title="Remove"
                      onClick={() => change({ milestones: draft.milestones.filter((_, i) => i !== index) })}
                      className={cn(quietIconClass, "text-destructive")}
                    >
                      <X className="size-4" />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {editable && (
          <button
            type="button"
            onClick={() => change({ milestones: [...draft.milestones, { name: "", mark: "none" }] })}
            className={cn(buttonClass, "self-start")}
          >
            Add milestone
          </button>
        )}
      </Panel>

      <RulesEditor rules={draft.rules} others={others} onChange={(rules) => change({ rules })} />

      <Panel title={editable ? "Start" : "State"}>
        {editable && (
          <ul aria-label="Checklist" className="m-0 flex list-none flex-col gap-1.5 p-0">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5">
                {item.done ? (
                  <Check className="size-5 text-chart-2" aria-label="Done" />
                ) : (
                  <X className="size-5 text-destructive" aria-label="Missing" />
                )}
                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => void run(save)} className={buttonClass}>
            {editable ? "Save" : "Save rules"}
          </button>
          {editable && (
            <button type="button" disabled={busy || !ready} onClick={() => void run(start)} className={buttonClass}>
              Start
            </button>
          )}
          {series.state === "running" &&
            (confirming === "finish" ? (
              <button type="button" disabled={busy} onClick={() => void run(finish)} className={buttonVariants({ variant: "destructive" })}>
                Finish {series.name}
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirming("finish")} className={buttonClass}>
                Finish
              </button>
            ))}
          {editable &&
            (confirming === "delete" ? (
              <button type="button" disabled={busy} onClick={() => void run(remove)} className={buttonVariants({ variant: "destructive" })}>
                Delete {series.name}
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirming("delete")} className={buttonVariants({ variant: "destructive" })}>
                Delete draft
              </button>
            ))}
          {saved && !busy && (
            <span role="status" className="font-heading text-2xl text-chart-2">
              Saved
            </span>
          )}
        </div>
      </Panel>
    </main>
  );
}

function RulesEditor({ rules, others, onChange }: { rules: string; others: AdminSeries[]; onChange: (rules: string) => void }) {
  const sources = others.filter((s) => s.rules.trim() !== "");
  const [source, setSource] = useState("");
  const picked = sources.find((s) => s.id === source) ?? sources[0];

  return (
    <Panel title="Rules">
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Copy rules from"
            value={picked?.id ?? ""}
            onChange={(event) => setSource(event.target.value)}
            className={cn(fieldClass, focus, "cursor-pointer")}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" disabled={!picked} onClick={() => picked && onChange(picked.rules)} className={buttonClass}>
            Copy from {picked?.name}
          </button>
        </div>
      )}
      <textarea
        aria-label="Rules in Markdown"
        value={rules}
        onChange={(event) => onChange(event.target.value)}
        rows={14}
        className={cn(fieldClass, focus, "min-h-60 resize-y py-2 text-sm leading-relaxed")}
      />
    </Panel>
  );
}
