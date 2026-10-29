import { Link, useParams } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClass, Segmented } from "@/components/controls";
import { readPage } from "@/components/page";
import { Rules } from "@/components/rules";
import { PixelIcon } from "@/components/pixel-icon";
import { League, SeriesFrame } from "@/components/page-frames";
import { PLAYER_FILL, PLAYER_RING, PlayerBadge, playerColour } from "@/components/player-badge";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { TrainerAdmin } from "@/components/trainer-admin";
import { UploadDialog } from "@/components/upload-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { playTime } from "@/lib/records";
import { downloadSnapshotZip } from "@/lib/snapshot-zip";
import { cn } from "@/lib/utils";
import { downloadLink } from "../../shared/games";
import { lang, messages } from "../../shared/i18n";
import { type LeaguePage, leaguePage, type LeagueRound, played, winnerOf } from "../../shared/league";
import { type SeriesPage as Series, seriesPage, type Trainer } from "../../shared/series";

const t = messages({
  en: {
    failed: "Something went wrong",
    download: "Download",
    trainers: "Trainers",
    round: (n: number) => `Round ${n}`,
    you: "You",
    toggle: (open: boolean, name: string) => `${open ? "Close" : "Open"} ${name}`,
    at: (milestone: string) => `At ${milestone}`,
    snapshotOf: (name: string) => `${name}'s snapshot`,
    pc: "PC",
    teams: "Teams",
    fainted: "Fainted",
    journey: "Journey",
    openPc: (name: string, milestone: string) => `Open ${name}'s PC at ${milestone}`,
    openTeams: (name: string) => `Open ${name}'s teams`,
    fallenOf: (name: string) => `${name}'s fallen`,
    journeyOf: (name: string) => `${name}'s journey`,
    snapshots: "Snapshots",
    downloadZipOf: (milestone: string) => `Download the ${milestone} zip`,
    downloadZip: "Download zip",
    upload: "Upload",
    trackAt: (name: string, milestone: string) => `${name} at ${milestone}`,
    trackSnapshots: (list: string) => `snapshots ${list}`,
    noSnapshots: "no snapshots",
    trackNone: (name: string) => `${name}, no snapshots`,
    league: "League",
    fullLeague: "Full league",
    standings: "Standings",
    roundsOf: (open: number, all: number) => `${open} of ${all} rounds`,
    toPlay: (n: number) => `${n} to play`,
    allPlayed: "All played",
    vs: "vs",
    matchLabel: (a: string, b: string, score: string | null) => `${a} vs ${b}, ${score ?? "to play"}`,
  },
  es: {
    failed: "Algo ha fallado",
    download: "Descargar",
    trainers: "Entrenadores",
    round: (n: number) => `Ronda ${n}`,
    you: "Tú",
    toggle: (open: boolean, name: string) => `${open ? "Cerrar" : "Abrir"} ${name}`,
    at: (milestone: string) => `En ${milestone}`,
    snapshotOf: (name: string) => `Captura de ${name}`,
    pc: "PC",
    teams: "Equipos",
    fainted: "Debilitados",
    journey: "Viaje",
    openPc: (name: string, milestone: string) => `Abrir el PC de ${name} en ${milestone}`,
    openTeams: (name: string) => `Abrir los equipos de ${name}`,
    fallenOf: (name: string) => `Caídos de ${name}`,
    journeyOf: (name: string) => `Viaje de ${name}`,
    snapshots: "Capturas",
    downloadZipOf: (milestone: string) => `Descargar el zip de ${milestone}`,
    downloadZip: "Descargar zip",
    upload: "Subir",
    trackAt: (name: string, milestone: string) => `${name} en ${milestone}`,
    trackSnapshots: (list: string) => `capturas ${list}`,
    noSnapshots: "sin capturas",
    trackNone: (name: string) => `${name}, sin capturas`,
    league: "Liga",
    fullLeague: "Liga completa",
    standings: "Clasificación",
    roundsOf: (open: number, all: number) => `${open} de ${all} rondas`,
    toPlay: (n: number) => `${n} por jugar`,
    allPlayed: "Todo jugado",
    vs: "vs",
    matchLabel: (a: string, b: string, score: string | null) => `${a} contra ${b}, ${score ?? "por jugar"}`,
  },
});

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

export function SeriesPage() {
  const { number } = useParams({ from: "/series/$number" });
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeries(null);
    setError(null);
    api(`/series/${encodeURIComponent(number)}`, seriesPage).then(setSeries, (caught: unknown) => setError(message(caught)));
  }, [number]);

  function reload() {
    api(`/series/${encodeURIComponent(number)}`, seriesPage).then(setSeries, () => undefined);
  }

  if (error) {
    return (
      <main className={cn(readPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!series) return <SeriesFrame />;

  return (
    <>
      <SeriesHeader series={series} />
      <main className={cn(readPage, "flex-none gap-3 pt-5 pb-6 sm:gap-3.5 sm:pt-6 sm:pb-8")}>
        <LeagueSummary number={series.number} />
        <Trainers series={series} onChanged={reload} />
      </main>
      <Rules rules={lang === "es" ? series.rulesEs || series.rules : series.rules || series.rulesEs} />
    </>
  );
}

const SUMMARY_PLACES = 3;

function LeagueSummary({ number }: { number: number }) {
  const { data: session } = authClient.useSession();
  const [league, setLeague] = useState<LeaguePage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLeague(null);
    setFailed(false);
    api(`/series/${number}/league`, leaguePage).then(setLeague, () => setFailed(true));
  }, [number]);

  if (failed) return null;
  if (!league) return <League />;
  if (league.roundMilestones.length === 0) return null;
  const names = new Map(league.players.map((p) => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? "?";
  const current = league.rounds.at(-1);

  return (
    <section aria-labelledby="league-title" className="mb-4 flex flex-col gap-3 sm:mb-5.5 sm:gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h2 id="league-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
          {t.league}
        </h2>
        <Link
          to="/series/$number/league"
          params={{ number: String(number) }}
          className="-my-2.5 flex min-h-11 items-center gap-1.5 font-heading text-[1.375rem] text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t.fullLeague}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5 rounded-[18px] border-3 bg-card px-4 pt-3.5 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
          <div className="flex items-baseline gap-2.5">
            <h3 className="m-0 font-heading text-[1.625rem] font-normal">{t.standings}</h3>
            <span className="font-heading text-xl text-muted-foreground">{t.roundsOf(league.rounds.length, league.roundMilestones.length)}</span>
          </div>
          <div className="overflow-hidden rounded-xl border-3 bg-box">
            {league.standings.slice(0, SUMMARY_PLACES).map((row, index, shown) => {
              const name = nameOf(row.player);
              const first = row.place === 1;
              return (
                <div
                  key={row.player}
                  className={cn(
                    "grid min-h-13 grid-cols-[32px_minmax(0,1fr)_56px_56px] items-center gap-2.5 px-3",
                    row.player === session?.user.id && "bg-yellow/6",
                    index < shown.length - 1 && "border-b-3",
                  )}
                >
                  <span className={cn("text-center font-heading text-[1.75rem]", first ? "text-yellow" : "text-faint")}>{row.place}</span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
                    <span className="truncate font-heading text-2xl">{name}</span>
                  </span>
                  <span className="text-right font-heading text-[1.75rem] text-yellow">{row.points}</span>
                  <span className="text-right font-heading text-[1.375rem] text-muted-foreground">
                    {row.wins}–{row.losses}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {current && <CurrentRound round={current} me={session?.user.id ?? null} nameOf={nameOf} />}
      </div>
    </section>
  );
}

function CurrentRound({ round, me, nameOf }: { round: LeagueRound; me: string | null; nameOf: (id: string) => string }) {
  const left = round.matches.filter((m) => !played(m)).length;
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border-3 border-primary bg-card px-4 pt-3.5 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h3 className="m-0 font-heading text-[1.625rem] font-normal">{t.round(round.number)}</h3>
        <span className="font-heading text-xl text-muted-foreground">{round.milestone}</span>
        <span className={cn("font-heading text-xl", left ? "text-warning" : "text-green")}>{left ? t.toPlay(left) : t.allPlayed}</span>
      </div>
      {round.matches.map((match) => {
        const done = played(match);
        const winner = winnerOf(match);
        const a = nameOf(match.a);
        const b = nameOf(match.b);
        const score = done ? `${match.gamesA}–${match.gamesB}` : null;
        return (
          <div
            key={match.id}
            role="group"
            aria-label={t.matchLabel(a, b, score)}
            className={cn(
              "grid min-h-13 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border-3 bg-box px-3",
              done ? "border-solid" : "border-dashed",
              match.a === me || match.b === me ? "border-trophy-rim" : "border-border",
            )}
          >
            <span aria-hidden="true" className={cn("flex min-w-0 items-center gap-2.5", winner && winner !== match.a && "opacity-55")}>
              <PlayerBadge name={a} colour={playerColour(a)} size="cell" />
              <span className={cn("truncate font-heading text-[1.4375rem]", winner === match.a && "text-yellow")}>{a}</span>
            </span>
            <span aria-hidden="true" className={cn("text-center font-heading", done ? "text-[1.4375rem]" : "text-[1.1875rem] text-faint")}>
              {score ?? t.vs}
            </span>
            <span aria-hidden="true" className={cn("flex min-w-0 items-center justify-end gap-2.5", winner && winner !== match.b && "opacity-55")}>
              <span className={cn("truncate font-heading text-[1.4375rem]", winner === match.b && "text-yellow")}>{b}</span>
              <PlayerBadge name={b} colour={playerColour(b)} size="cell" />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SeriesHeader({ series }: { series: Series }) {
  const look = SCENE_LOOK[series.scene];
  const desktop = useMediaQuery("(min-width: 40rem)");
  const [download, setDownload] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [first, ...rest] = (series.game ?? "").split(" + ");

  async function fetchGame() {
    setBusy(true);
    setDownload(null);
    try {
      const { url } = await api(`/series/${series.number}/download`, downloadLink);
      window.location.assign(url);
    } catch (caught) {
      setDownload(message(caught));
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="series-title" className={cn("relative h-55 overflow-hidden sm:h-65", look.ground)}>
      <SceneArt scene={series.scene} width={desktop ? 360 : 98} height={desktop ? 65 : 55} />
      <div className={cn(readPage, "relative h-full items-start gap-4.5 pt-7 sm:gap-5.5 sm:pt-10")}>
        <h1
          id="series-title"
          className={cn("m-0 font-heading text-[4.75rem] leading-[0.8] font-normal text-white sm:text-8xl", look.title)}
        >
          {series.name}
        </h1>
        {series.game && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border-3 p-2 pl-3 sm:gap-5.5 sm:p-2.5 sm:pl-3.5",
              look.panel,
            )}
          >
            <span className="flex items-center gap-2.5 sm:gap-3">
              <PixelIcon name="cartridge" className="size-8.5 sm:size-10" />
              <span className="flex flex-col leading-tight">
                <span className="text-[1.0625rem] font-extrabold sm:text-xl">{first}</span>
                {rest.length > 0 && <span className={cn("text-sm font-bold", look.panelSub)}>{rest.join(" + ")}</span>}
              </span>
            </span>
            {series.canDownload && (
              <button type="button" disabled={busy} onClick={() => void fetchGame()} className={cn(buttonClass, look.button)}>
                <PixelIcon name="download" className="size-4" />
                {t.download}
              </button>
            )}
          </div>
        )}
        {download && (
          <p role="alert" className="m-0 rounded-md bg-ink px-2 text-sm text-destructive">
            {download}
          </p>
        )}
      </div>
    </section>
  );
}

function Trainers({ series, onChanged }: { series: Series; onChanged: () => void }) {
  const { data } = authClient.useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const uploading = series.trainers.find((trainer) => trainer.id === uploadFor);
  const columns = `repeat(${Math.max(series.milestones.length, 1)}, minmax(0, 1fr))`;
  let round = 0;
  const heads = series.milestones.map((m) => ({ ...m, round: m.mark === "round" ? ++round : 0 }));

  return (
    <section aria-labelledby="trainers-title" className="flex flex-col gap-3 sm:gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h2 id="trainers-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
          {t.trainers}
        </h2>
      </div>
      <div className="overflow-hidden rounded-2xl border-3 bg-card">
        <div className="sm:overflow-x-auto">
          <div className="sm:min-w-200">
            <div aria-hidden="true" className="grid items-stretch border-b-3 bg-box px-3 sm:hidden" style={{ gridTemplateColumns: columns }}>
              {heads.map((m) => (
                <span
                  key={m.name}
                  className={cn(
                    "grid min-h-9 place-items-center font-heading text-xl",
                    m.mark === "tournament" ? "text-yellow" : m.round > 0 ? "bg-round/10 text-round-ink" : "text-subtle",
                  )}
                >
                  {m.mark === "tournament" ? <Trophy className="size-4" /> : shortName(m.name)}
                </span>
              ))}
            </div>
            <div className="hidden grid-cols-[300px_minmax(0,1fr)_84px] items-stretch border-b-3 bg-box sm:grid">
              <span />
              <div className="grid items-end" style={{ gridTemplateColumns: columns }}>
                {heads.map((m) => (
                  <div key={m.name} className={cn("flex flex-col items-center gap-1 px-1 pt-3.5 pb-3", m.round > 0 && "bg-round/10")}>
                    <span
                      className={cn(
                        "font-heading text-xl whitespace-nowrap",
                        m.mark === "tournament" ? "text-yellow" : m.round > 0 ? "text-round-ink" : "text-subtle",
                      )}
                    >
                      {m.name}
                    </span>
                    <span className="flex h-5.5 items-center">
                      {m.round > 0 && (
                        <span className="rounded-sm bg-round px-2 font-heading text-lg leading-5.5 whitespace-nowrap text-white">
                          {t.round(m.round)}
                        </span>
                      )}
                      {m.mark === "tournament" && <Trophy className="size-5" />}
                    </span>
                  </div>
                ))}
              </div>
              <span />
            </div>
            {series.trainers.map((trainer, index) => (
              <TrainerRow
                key={trainer.id}
                seriesNumber={series.number}
                trainer={trainer}
                you={trainer.id === data?.user.id}
                open={open === trainer.id}
                last={index === series.trainers.length - 1}
                onToggle={() => setOpen(open === trainer.id ? null : trainer.id)}
                onOpen={() => setOpen(trainer.id)}
                milestones={heads}
                columns={columns}
                onUpload={() => setUploadFor(trainer.id)}
                onChanged={onChanged}
              />
            ))}
          </div>
        </div>
      </div>
      {uploading && (
        <UploadDialog
          open
          onOpenChange={(next) => !next && setUploadFor(null)}
          seriesNumber={series.number}
          trainer={uploading}
          forOther={uploading.id !== data?.user.id}
          milestones={series.milestones.map((m) => m.name)}
          onSaved={onChanged}
        />
      )}
    </section>
  );
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

function TrainerRow({
  seriesNumber,
  trainer,
  you,
  open,
  last,
  onToggle,
  onOpen,
  milestones,
  columns,
  onUpload,
  onChanged,
}: {
  seriesNumber: number;
  trainer: Trainer;
  you: boolean;
  open: boolean;
  last: boolean;
  onToggle: () => void;
  onOpen: () => void;
  milestones: Milestone[];
  columns: string;
  onUpload: () => void;
  onChanged: () => void;
}) {
  const latest = trainer.snapshots.at(-1);
  const desktop = useMediaQuery("(min-width: 40rem)");
  const [picked, setPicked] = useState<string | null>(null);
  const shown = trainer.snapshots.find((s) => s.milestone === picked) ?? latest;
  const [zipError, setZipError] = useState<string | null>(null);

  async function fetchZip(milestone: string) {
    setZipError(null);
    try {
      await downloadSnapshotZip(seriesNumber, trainer.id, milestone);
    } catch (caught) {
      setZipError(message(caught));
    }
  }

  return (
    <div className={cn(!last && "border-b-3")}>
      <div
        className={cn(
          "group grid grid-cols-1 items-center hover:bg-row-hi sm:min-h-24 sm:grid-cols-[300px_minmax(0,1fr)_84px]",
          open ? "bg-row-hi" : you && "bg-yellow/6",
        )}
      >
        <span className="flex min-h-13 items-center gap-2.5 self-stretch pt-2 pl-3 sm:gap-3.5 sm:px-6 sm:pt-0">
          <Link
            to="/players/$player"
            params={{ player: trainer.id }}
            className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg decoration-3 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-3.5"
          >
            <PlayerBadge name={trainer.name} colour={playerColour(trainer.name)} size="row" />
            <span className="truncate font-heading text-[1.625rem] leading-none sm:text-3xl sm:leading-tight">{trainer.name}</span>
          </Link>
          {you && <span className="flex-none rounded-sm bg-yellow px-1.5 font-heading text-base text-ink sm:px-1.75 sm:text-lg">{t.you}</span>}
          {!desktop && (
            <button
              type="button"
              aria-label={t.toggle(open, trainer.name)}
              aria-expanded={open}
              onClick={onToggle}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-end gap-2.5 self-stretch pr-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {trainer.progress && <span className="font-heading text-xl text-muted-foreground">{trainer.progress}</span>}
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-[9px] border-3 border-cell-hi bg-cell group-hover:border-primary"
              >
                <svg viewBox="0 0 22 16" className={cn("h-2.5 w-3.5 fill-primary", open && "rotate-180")}>
                  <path d="M2 3h18l-9 11z" />
                </svg>
              </span>
            </button>
          )}
        </span>
        <Track
          trainer={trainer}
          milestones={milestones}
          columns={columns}
          shown={shown?.milestone}
          interactive={desktop}
          onPick={(milestone) => {
            setPicked(milestone);
            onOpen();
          }}
        />
        <span className="hidden items-center justify-end pr-6 sm:flex">
          <button
            type="button"
            aria-label={t.toggle(open, trainer.name)}
            aria-expanded={open}
            onClick={onToggle}
            className="grid size-11 cursor-pointer place-items-center rounded-lg border-3 border-cell-hi bg-cell outline-none group-hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <svg viewBox="0 0 22 16" aria-hidden="true" className={cn("h-3 w-4 fill-primary", open && "rotate-180")}>
              <path d="M2 3h18l-9 11z" />
            </svg>
          </button>
        </span>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t-3 border-dashed bg-box px-3 pt-3 pb-4 sm:flex sm:flex-wrap sm:items-stretch sm:gap-3.5 sm:px-6 sm:pt-4 sm:pb-6">
          {shown && desktop && <span className="flex-[1_0_100%] font-heading text-2xl text-primary">{t.at(shown.milestone)}</span>}
          {shown && !desktop && (
            <Segmented
              label={t.snapshotOf(trainer.name)}
              size="lg"
              options={trainer.snapshots.map((s) => ({ value: s.milestone, label: s.milestone }))}
              value={shown.milestone}
              onChange={setPicked}
              className="col-span-2 flex flex-wrap"
            />
          )}
          <Tile
            label={t.pc}
            value={shown?.pokemon}
            link={shown && { player: trainer.id, number: String(seriesNumber), label: t.openPc(trainer.name, shown.milestone), snapshot: shown.milestone }}
          />
          <Tile label={t.teams} value={trainer.teams} link={{ player: trainer.id, label: t.openTeams(trainer.name), teams: true }} />
          <Tile
            label={t.fainted}
            value={shown?.fainted}
            alarm
            link={{ player: trainer.id, number: String(seriesNumber), label: t.fallenOf(trainer.name), hash: "fallen" }}
          />
          <Tile
            label={t.journey}
            value={shown && playTime(shown.playTime)}
            wide
            link={{ player: trainer.id, number: String(seriesNumber), label: t.journeyOf(trainer.name), hash: "journey" }}
          />
          {desktop && (
            <div className="flex min-w-65 flex-1 flex-col gap-1.5 rounded-xl border-3 bg-card px-4 py-3">
              <span className="font-heading text-xl text-muted-foreground">{t.snapshots}</span>
              <span className="flex min-h-12 flex-wrap items-center gap-2">
                {trainer.snapshots.map((s) => (
                  <span
                    key={s.milestone}
                    className={cn(
                      "flex min-h-10 items-center gap-1 overflow-hidden rounded-md border-3 bg-cell font-heading text-2xl",
                      s.zip && "pr-0.5",
                      s === shown ? "border-primary" : "border-transparent",
                    )}
                  >
                    <Link
                      to="/players/$player/series/$number/pc"
                      params={{ player: trainer.id, number: String(seriesNumber) }}
                      search={{ snapshot: s.milestone }}
                      aria-label={t.openPc(trainer.name, s.milestone)}
                      className={cn(
                        "flex items-center self-stretch pl-3 text-foreground outline-none hover:bg-primary hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                        s.zip ? "pr-1.5" : "pr-3",
                      )}
                    >
                      {s.milestone}
                    </Link>
                    {s.zip && (
                      <button
                        type="button"
                        aria-label={t.downloadZipOf(s.milestone)}
                        title={t.downloadZip}
                        onClick={() => void fetchZip(s.milestone)}
                        className="grid size-8.5 cursor-pointer place-items-center rounded-sm outline-none hover:bg-border focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <PixelIcon name="download" className="size-3.5 text-primary" />
                      </button>
                    )}
                  </span>
                ))}
                {trainer.snapshots.length === 0 && !trainer.canUpload && <span className="font-heading text-2xl text-faint">—</span>}
                {trainer.canUpload && (
                  <button type="button" aria-haspopup="dialog" onClick={onUpload} className={cn(buttonClass, "min-h-10 px-3.5 text-2xl")}>
                    <PixelIcon name="upload" className="size-3.5 text-primary" />
                    {t.upload}
                  </button>
                )}
              </span>
              {zipError && (
                <p role="alert" className="m-0 text-sm text-destructive">
                  {zipError}
                </p>
              )}
            </div>
          )}
          {trainer.canUpload && !desktop && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={onUpload}
              className={cn(buttonClass, "col-span-2 mt-0.5 min-h-12 px-3.5 text-[1.375rem]")}
            >
              <PixelIcon name="upload" className="size-3.5 text-primary" />
              {t.upload}
            </button>
          )}
          {trainer.sources && (
            <TrainerAdmin
              seriesNumber={seriesNumber}
              trainer={trainer}
              shown={shown}
              milestones={milestones.map((m) => m.name)}
              onChanged={onChanged}
              onMoved={setPicked}
            />
          )}
        </div>
      )}
    </div>
  );
}

type Milestone = { name: string; mark: string; round: number };

const RING_SIZE = {
  here: "size-9 rounded-[10px] sm:size-14 sm:rounded-[14px]",
  tournament: "size-9 rounded-full sm:size-16",
  round: "size-7.5 rounded-full sm:size-11",
  plain: "size-5.5 rounded-full sm:size-8",
} as const;

function Track({
  trainer,
  milestones,
  columns,
  shown,
  interactive,
  onPick,
}: {
  trainer: Trainer;
  milestones: Milestone[];
  columns: string;
  shown: string | undefined;
  interactive: boolean;
  onPick: (milestone: string) => void;
}) {
  const colour = playerColour(trainer.name);
  const taken = new Set(trainer.snapshots.map((s) => s.milestone));
  const at = trainer.progress ? milestones.findIndex((m) => m.name === trainer.progress) : -1;
  const count = Math.max(milestones.length, 1);
  const label = trainer.progress
    ? `${t.trackAt(trainer.name, trainer.progress)} · ${trainer.snapshots.length > 0 ? t.trackSnapshots(trainer.snapshots.map((s) => s.milestone).join(", ")) : t.noSnapshots}`
    : t.trackNone(trainer.name);

  return (
    <span
      role={interactive ? undefined : "img"}
      aria-label={interactive ? undefined : label}
      className="relative mx-3 mb-2 grid h-12.5 sm:mx-0 sm:mb-0 sm:h-auto sm:self-stretch"
      style={{ gridTemplateColumns: columns }}
    >
      <span className="absolute top-1/2 -mt-0.5 h-1 rounded-sm bg-ink sm:-mt-0.75 sm:h-1.5" style={{ left: `${50 / count}%`, right: `${50 / count}%` }} />
      {at > 0 && (
        <span
          className={cn("absolute top-1/2 -mt-0.5 h-1 rounded-sm sm:-mt-0.75 sm:h-1.5", PLAYER_FILL[colour])}
          style={{ left: `${50 / count}%`, width: `${(at * 100) / count}%` }}
        />
      )}
      {milestones.map((m, i) => {
        const got = i <= at;
        const here = i === at;
        const snap = taken.has(m.name);
        const ring = cn(
          "box-border border-2 sm:border-3",
          RING_SIZE[here ? "here" : m.mark === "tournament" ? "tournament" : m.round > 0 ? "round" : "plain"],
          m.name === shown ? "border-primary" : "border-primary/35 sm:border-primary/30",
        );
        return (
          <span key={m.name} className={cn("relative grid place-items-center", m.round > 0 && "bg-round/10")}>
            {m.mark === "tournament" ? (
              <span className="grid size-7.5 place-items-center rounded-full border-2 border-trophy-rim bg-trophy sm:size-13 sm:border-3">
                <Trophy className="size-4 sm:size-7" />
              </span>
            ) : m.round > 0 ? (
              <span
                className={cn(
                  "size-5.5 rounded-full border-3 shadow-[0_0_0_2px_var(--card)] sm:size-7.5 sm:border-4 sm:shadow-[0_0_0_3px_var(--card)]",
                  got ? cn("border-destructive", PLAYER_FILL[colour]) : "border-round-dim bg-cell",
                )}
              />
            ) : (
              <span className={cn("size-3 rounded-full sm:size-4", got ? PLAYER_FILL[colour] : "bg-cell")} />
            )}
            {snap && !interactive && <span aria-hidden="true" className={cn("absolute top-1/2 left-1/2 -translate-1/2", ring)} />}
            {here && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1/2 left-1/2 -mt-3.5 -ml-3.5 grid size-7 place-items-center rounded-[7px] border-3 border-ink font-heading text-lg leading-none text-ink ring-2 [text-box:trim-both_cap_alphabetic] animate-track-bob motion-reduce:animate-none sm:-mt-5.5 sm:-ml-5.5 sm:size-11 sm:rounded-[10px] sm:border-4 sm:text-[1.5625rem] sm:ring-3",
                  PLAYER_FILL[colour],
                  m.round > 0 ? "ring-destructive" : PLAYER_RING[colour],
                )}
              >
                {trainer.name.charAt(0).toUpperCase()}
              </span>
            )}
            {snap && interactive && (
              <button
                type="button"
                aria-label={t.trackAt(trainer.name, m.name)}
                aria-pressed={m.name === shown}
                onClick={() => onPick(m.name)}
                className="group/ring absolute top-1/2 left-1/2 -mt-7 -ml-7 grid size-14 cursor-pointer place-items-center rounded-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span aria-hidden="true" className={cn(ring, m.name !== shown && "group-hover/ring:border-primary/70")} />
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}

type TileLink = { player: string; label: string } & ({ teams: true } | { number: string; hash?: "fallen" | "journey"; snapshot?: string });

function Tile({ label, value, alarm, wide, link }: { label: string; value?: number | string; alarm?: boolean; wide?: boolean; link?: TileLink }) {
  const body = (
    <>
      <span className="flex items-center gap-2 font-heading text-[1.1875rem] text-muted-foreground sm:text-xl">
        {label}
        {link && (
          <svg viewBox="0 0 14 18" aria-hidden="true" className="h-3 w-2 fill-primary sm:hidden">
            <path d="M2 2l10 7-10 7z" />
          </svg>
        )}
      </span>
      <span
        className={cn(
          "font-heading text-4xl leading-[0.9] whitespace-nowrap tabular-nums sm:text-5xl",
          value === undefined ? "text-faint" : alarm && typeof value === "number" && value > 0 ? "text-destructive" : "text-foreground",
        )}
      >
        {value ?? "—"}
      </span>
    </>
  );
  const tile = cn(
    "flex flex-col gap-1 rounded-xl border-3 bg-card px-3 py-2.5 sm:gap-1.5 sm:px-4 sm:py-3",
    wide ? "sm:min-w-37.5" : "sm:min-w-32.5",
  );
  if (!link) return <div className={tile}>{body}</div>;
  const lift =
    "outline-none transition-[translate,border-color] duration-120 ease-[steps(2)] hover:-translate-y-0.5 hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
  if ("teams" in link) {
    return (
      <Link to="/teams" search={{ player: link.player }} aria-label={link.label} className={cn(tile, lift)}>
        {body}
      </Link>
    );
  }
  if (link.hash) {
    return (
      <Link
        to="/players/$player/series/$number"
        params={{ player: link.player, number: link.number }}
        hash={link.hash}
        aria-label={link.label}
        className={cn(tile, lift)}
      >
        {body}
      </Link>
    );
  }
  return (
    <Link
      to="/players/$player/series/$number/pc"
      params={{ player: link.player, number: link.number }}
      search={link.snapshot ? { snapshot: link.snapshot } : {}}
      aria-label={link.label}
      className={cn(tile, lift)}
    >
      {body}
    </Link>
  );
}

