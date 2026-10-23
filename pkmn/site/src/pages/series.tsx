import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { buttonClass } from "@/components/controls";
import { toolPage } from "@/components/page";
import { PixelIcon } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { UploadDialog } from "@/components/upload-dialog";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { downloadSnapshotZip } from "@/lib/snapshot-zip";
import { cn } from "@/lib/utils";
import { downloadLink } from "../../shared/games";
import { type SeriesPage as Series, seriesPage, type Trainer } from "../../shared/series";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
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
      <main className={cn(toolPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!series) return <main className={toolPage} />;

  return (
    <>
      <SeriesHeader series={series} />
      <main className={cn(toolPage, "gap-3.5 pt-6 pb-8")}>
        <League />
        <Trainers series={series} onChanged={reload} />
      </main>
      <Rules rules={series.rules} />
    </>
  );
}

function SeriesHeader({ series }: { series: Series }) {
  const look = SCENE_LOOK[series.scene];
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
    <section aria-labelledby="series-title" className={cn("relative h-52 overflow-hidden sm:h-65", look.ground)}>
      <SceneArt scene={series.scene} width={360} height={65} />
      <div className={cn(toolPage, "relative h-full items-start gap-4 pt-7 sm:gap-5.5 sm:pt-10")}>
        <h1 id="series-title" className={cn("m-0 font-heading text-6xl leading-[0.8] font-normal text-white sm:text-8xl", look.title)}>
          {series.name}
        </h1>
        {series.game && (
          <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border-3 p-2 pl-3 sm:gap-5.5 sm:p-2.5 sm:pl-3.5", look.panel)}>
            <span className="flex items-center gap-3">
              <PixelIcon name="cartridge" className="size-8 sm:size-10" />
              <span className="flex flex-col leading-tight">
                <span className="text-lg font-extrabold sm:text-xl">{first}</span>
                {rest.length > 0 && <span className={cn("text-sm font-bold", look.panelSub)}>{rest.join(" + ")}</span>}
              </span>
            </span>
            {series.canDownload && (
              <button type="button" disabled={busy} onClick={() => void fetchGame()} className={cn(buttonClass, look.button)}>
                <PixelIcon name="download" className="size-4" />
                Download
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

function League() {
  return (
    <section aria-labelledby="league-title" className="mb-5.5 flex flex-col gap-3.5">
      <h2 id="league-title" className="m-0 font-heading text-4xl font-normal">
        League
      </h2>
      <div className="flex min-h-35 items-center justify-center gap-4.5 rounded-2xl border-3 border-dashed border-cell-hi bg-box">
        <PixelIcon name="barrier" className="size-14" />
        <span className="font-heading text-4xl text-yellow">Work in progress</span>
      </div>
    </section>
  );
}

function Trainers({ series, onChanged }: { series: Series; onChanged: () => void }) {
  const { data } = authClient.useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const uploading = series.trainers.find((t) => t.id === uploadFor);
  const columns = `repeat(${Math.max(series.milestones.length, 1)}, minmax(0, 1fr))`;
  let round = 0;
  const heads = series.milestones.map((m) => ({ ...m, round: m.mark === "round" ? ++round : 0 }));

  return (
    <section aria-labelledby="trainers-title" className="flex flex-col gap-3.5">
      <h2 id="trainers-title" className="m-0 font-heading text-4xl font-normal">
        Trainers
      </h2>
      <div className="overflow-hidden rounded-2xl border-3 bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-200">
            <div className="grid grid-cols-[300px_minmax(0,1fr)_84px] items-stretch border-b-3 bg-box">
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
                          Round {m.round}
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
                milestones={heads}
                columns={columns}
                onUpload={() => setUploadFor(trainer.id)}
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
  milestones,
  columns,
  onUpload,
}: {
  seriesNumber: number;
  trainer: Trainer;
  you: boolean;
  open: boolean;
  last: boolean;
  onToggle: () => void;
  milestones: { name: string; mark: string; round: number }[];
  columns: string;
  onUpload: () => void;
}) {
  const latest = trainer.snapshots.at(-1);
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
          "group grid min-h-24 grid-cols-[300px_minmax(0,1fr)_84px] items-center hover:bg-row-hi",
          open ? "bg-row-hi" : you && "bg-yellow/6",
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex cursor-pointer items-center gap-3.5 self-stretch px-6 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PlayerBadge name={trainer.name} colour={playerColour(trainer.id)} size="lg" />
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-heading text-3xl leading-tight decoration-3 underline-offset-4 group-hover:underline">
              {trainer.name}
            </span>
            {you && <span className="rounded-sm bg-yellow px-1.75 font-heading text-lg text-ink">You</span>}
          </span>
        </button>
        <span className="relative grid self-stretch" style={{ gridTemplateColumns: columns }}>
          <span
            className="absolute top-1/2 -mt-0.75 h-1.5 rounded-sm bg-ink"
            style={{ left: `${50 / Math.max(milestones.length, 1)}%`, right: `${50 / Math.max(milestones.length, 1)}%` }}
          />
          {milestones.map((m) => (
            <span key={m.name} className={cn("relative grid place-items-center", m.round > 0 && "bg-round/10")}>
              {m.mark === "tournament" ? (
                <span className="grid size-13 place-items-center rounded-full border-3 border-trophy-rim bg-trophy">
                  <Trophy className="size-7" />
                </span>
              ) : m.round > 0 ? (
                <span className="size-7.5 rounded-full border-4 border-round-dim bg-cell shadow-[0_0_0_3px_var(--card)]" />
              ) : (
                <span className="size-4 rounded-full bg-cell" />
              )}
            </span>
          ))}
        </span>
        <span className="flex items-center justify-end pr-6">
          <button
            type="button"
            aria-label={`${open ? "Close" : "Open"} ${trainer.name}`}
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
        <div className="flex flex-wrap items-stretch gap-3.5 border-t-3 border-dashed bg-box px-6 pt-4 pb-6">
          {latest && <span className="flex-[1_0_100%] font-heading text-2xl text-primary">At {latest.milestone}</span>}
          <Tile
            label="PC"
            value={latest?.pokemon}
            link={latest && { player: trainer.id, number: String(seriesNumber), label: `Open ${trainer.name}'s PC` }}
          />
          <Tile label="Teams" />
          <Tile label="Fainted" value={latest?.fainted} alarm />
          <div className="flex min-w-65 flex-1 flex-col gap-1.5 rounded-xl border-3 bg-card px-4 py-3">
            <span className="font-heading text-xl text-muted-foreground">Snapshots</span>
            <span className="flex min-h-12 flex-wrap items-center gap-2">
              {trainer.snapshots.map((s) => (
                <span
                  key={s.milestone}
                  className={cn(
                    "flex min-h-10 items-center gap-1 overflow-hidden rounded-md border-3 bg-cell font-heading text-2xl",
                    s.zip && "pr-0.5",
                    s === latest ? "border-primary" : "border-transparent",
                  )}
                >
                  <Link
                    to="/players/$player/series/$number/pc"
                    params={{ player: trainer.id, number: String(seriesNumber) }}
                    search={{ snapshot: s.milestone }}
                    aria-label={`Open ${trainer.name}'s PC at ${s.milestone}`}
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
                      aria-label={`Download the ${s.milestone} zip`}
                      title="Download zip"
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
                  Upload
                </button>
              )}
            </span>
            {zipError && (
              <p role="alert" className="m-0 text-sm text-destructive">
                {zipError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type TileLink = { player: string; number: string; label: string };

function Tile({ label, value, alarm, link }: { label: string; value?: number; alarm?: boolean; link?: TileLink }) {
  const body = (
    <>
      <span className="font-heading text-xl text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-heading text-5xl leading-[0.9] tabular-nums",
          value === undefined ? "text-faint" : alarm && value > 0 ? "text-destructive" : "text-foreground",
        )}
      >
        {value ?? "—"}
      </span>
    </>
  );
  const tile = "flex min-w-32.5 flex-col gap-1.5 rounded-xl border-3 bg-card px-4 py-3";
  if (!link) return <div className={tile}>{body}</div>;
  return (
    <Link
      to="/players/$player/series/$number/pc"
      params={{ player: link.player, number: link.number }}
      search={{}}
      aria-label={link.label}
      className={cn(
        tile,
        "outline-none transition-[translate,border-color] duration-120 ease-[steps(2)] hover:-translate-y-0.5 hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      {body}
    </Link>
  );
}

const RULES: Components = {
  h1: ({ children }) => <h3 className="m-0 mb-3 font-heading text-4xl font-normal text-white">{children}</h3>,
  h2: ({ children }) => <h4 className="m-0 mt-5 mb-1 font-heading text-3xl font-normal break-after-avoid text-primary first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="m-0 mt-4 mb-1 font-heading text-2xl font-normal break-after-avoid text-primary">{children}</h5>,
  h4: ({ children }) => <h6 className="m-0 mt-3 mb-1 font-heading text-xl font-normal break-after-avoid text-subtle">{children}</h6>,
  p: ({ children }) => <p className="m-0 mb-3">{children}</p>,
  ul: ({ children }) => <ul className="m-0 mb-3 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="m-0 mb-3 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="mb-1.5">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-extrabold text-white">{children}</strong>,
  code: ({ children }) => <code className="rounded-sm bg-muted px-1 text-base">{children}</code>,
  blockquote: ({ children }) => <blockquote className="m-0 mb-3 border-l-3 border-cell-hi pl-3.5 text-subtle">{children}</blockquote>,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto break-inside-avoid">
      <table className="w-full border-collapse text-base">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b-3 px-2 py-1 text-left font-bold">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
  hr: () => <hr className="my-4 border-t-3 border-cell" />,
};

function Rules({ rules }: { rules: string }) {
  if (rules.trim() === "") return null;
  return (
    <section aria-labelledby="rules-title" className={cn(toolPage, "flex-none gap-3.5 pt-2 pb-14")}>
      <h2 id="rules-title" className="m-0 font-heading text-4xl font-normal">
        Rules
      </h2>
      <div className="rounded-2xl border-3 bg-card px-5 py-5 text-lg leading-relaxed sm:px-8 sm:py-6.5 lg:columns-2 lg:gap-14 lg:[column-rule:3px_solid_var(--cell)]">
        <Markdown remarkPlugins={[remarkGfm]} skipHtml components={RULES}>
          {rules}
        </Markdown>
      </div>
    </section>
  );
}
