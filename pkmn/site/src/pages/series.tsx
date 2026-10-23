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
import { useMediaQuery } from "@/hooks/use-media-query";
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
      <main className={cn(toolPage, "gap-3 pt-5 pb-6 sm:gap-3.5 sm:pt-6 sm:pb-8")}>
        <League />
        <Trainers series={series} onChanged={reload} />
      </main>
      <Rules rules={series.rules} />
    </>
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
      <div className={cn(toolPage, "relative h-full items-start gap-4.5 pt-7 sm:gap-5.5 sm:pt-10")}>
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
    <section aria-labelledby="league-title" className="mb-4 flex flex-col gap-3 sm:mb-5.5 sm:gap-3.5">
      <h2 id="league-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
        League
      </h2>
      <div className="flex min-h-24 items-center justify-center gap-3.5 rounded-2xl border-3 border-dashed border-cell-hi bg-box sm:min-h-35 sm:gap-4.5">
        <PixelIcon name="barrier" className="size-10 sm:size-14" />
        <span className="font-heading text-[1.75rem] text-yellow sm:text-4xl">Work in progress</span>
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
    <section aria-labelledby="trainers-title" className="flex flex-col gap-3 sm:gap-3.5">
      <h2 id="trainers-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
        Trainers
      </h2>
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
  const desktop = useMediaQuery("(min-width: 40rem)");
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
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-h-13 cursor-pointer items-center gap-2.5 self-stretch px-3 pt-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-3.5 sm:px-6 sm:pt-0"
        >
          <PlayerBadge name={trainer.name} colour={playerColour(trainer.id)} size="row" />
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-heading text-[1.625rem] leading-none decoration-3 underline-offset-4 group-hover:underline sm:text-3xl sm:leading-tight">
              {trainer.name}
            </span>
            {you && <span className="rounded-sm bg-yellow px-1.5 font-heading text-base text-ink sm:px-1.75 sm:text-lg">You</span>}
          </span>
          <span className="ml-auto flex flex-none items-center gap-2.5 sm:hidden">
            {latest && <span className="font-heading text-xl text-muted-foreground">{latest.milestone}</span>}
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-[9px] border-3 border-cell-hi bg-cell group-hover:border-primary"
            >
              <svg viewBox="0 0 22 16" className={cn("h-2.5 w-3.5 fill-primary", open && "rotate-180")}>
                <path d="M2 3h18l-9 11z" />
              </svg>
            </span>
          </span>
        </button>
        <span
          role={desktop ? undefined : "img"}
          aria-label={desktop ? undefined : latest ? `${trainer.name} at ${latest.milestone}` : `${trainer.name}, no snapshots`}
          className="relative mx-3 mb-2 grid h-12.5 sm:mx-0 sm:mb-0 sm:h-auto sm:self-stretch"
          style={{ gridTemplateColumns: columns }}
        >
          <span
            className="absolute top-1/2 -mt-0.5 h-1 rounded-sm bg-ink sm:-mt-0.75 sm:h-1.5"
            style={{ left: `${50 / Math.max(milestones.length, 1)}%`, right: `${50 / Math.max(milestones.length, 1)}%` }}
          />
          {milestones.map((m) => (
            <span key={m.name} className={cn("relative grid place-items-center", m.round > 0 && "bg-round/10")}>
              {m.mark === "tournament" ? (
                <span className="grid size-7.5 place-items-center rounded-full border-2 border-trophy-rim bg-trophy sm:size-13 sm:border-3">
                  <Trophy className="size-4 sm:size-7" />
                </span>
              ) : m.round > 0 ? (
                <span className="size-5.5 rounded-full border-3 border-round-dim bg-cell shadow-[0_0_0_2px_var(--card)] sm:size-7.5 sm:border-4 sm:shadow-[0_0_0_3px_var(--card)]" />
              ) : (
                <span className="size-3 rounded-full bg-cell sm:size-4" />
              )}
            </span>
          ))}
        </span>
        <span className="hidden items-center justify-end pr-6 sm:flex">
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
        <div className="grid grid-cols-2 gap-2 border-t-3 border-dashed bg-box px-3 pt-3 pb-4 sm:flex sm:flex-wrap sm:items-stretch sm:gap-3.5 sm:px-6 sm:pt-4 sm:pb-6">
          {latest && <span className="hidden flex-[1_0_100%] font-heading text-2xl text-primary sm:block">At {latest.milestone}</span>}
          <Tile
            label="PC"
            value={latest?.pokemon}
            link={latest && { player: trainer.id, number: String(seriesNumber), label: `Open ${trainer.name}'s PC` }}
          />
          <Tile label="Teams" />
          <Tile label="Fainted" value={latest?.fainted} alarm />
          <div className="col-span-2 flex flex-col gap-1 rounded-xl border-3 bg-card px-3 py-2.5 sm:min-w-65 sm:flex-1 sm:gap-1.5 sm:px-4 sm:py-3">
            <span className="font-heading text-[1.1875rem] text-muted-foreground sm:text-xl">Snapshots</span>
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
              {trainer.snapshots.length === 0 && (
                <span className={cn("font-heading text-2xl text-faint", trainer.canUpload && "sm:hidden")}>—</span>
              )}
              {trainer.canUpload && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={onUpload}
                  className={cn(buttonClass, "hidden min-h-10 px-3.5 text-2xl sm:inline-flex")}
                >
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
          {trainer.canUpload && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={onUpload}
              className={cn(buttonClass, "col-span-2 mt-0.5 min-h-12 px-3.5 text-[1.375rem] sm:hidden")}
            >
              <PixelIcon name="upload" className="size-3.5 text-primary" />
              Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type TileLink = { player: string; number: string; label: string };

function Tile({ label, value, alarm, link }: { label: string; value?: number; alarm?: boolean; link?: TileLink }) {
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
          "font-heading text-4xl leading-[0.9] tabular-nums sm:text-5xl",
          value === undefined ? "text-faint" : alarm && value > 0 ? "text-destructive" : "text-foreground",
        )}
      >
        {value ?? "—"}
      </span>
    </>
  );
  const tile = "flex flex-col gap-1 rounded-xl border-3 bg-card px-3 py-2.5 sm:min-w-32.5 sm:gap-1.5 sm:px-4 sm:py-3";
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
  h2: ({ children }) => <h4 className="m-0 mt-5 mb-1 font-heading text-[1.5625rem] font-normal break-after-avoid text-primary first:mt-0 sm:text-3xl">{children}</h4>,
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
    <section aria-labelledby="rules-title" className={cn(toolPage, "flex-none gap-3 pt-2 pb-10 sm:gap-3.5 sm:pb-14")}>
      <h2 id="rules-title" className="m-0 font-heading text-[2.125rem] font-normal sm:text-4xl">
        Rules
      </h2>
      <div className="rounded-2xl border-3 bg-card px-4.5 pt-4.5 pb-1 text-base leading-relaxed sm:px-8 sm:text-lg sm:py-6.5 lg:columns-2 lg:gap-14 lg:[column-rule:3px_solid_var(--cell)]">
        <Markdown remarkPlugins={[remarkGfm]} skipHtml components={RULES}>
          {rules}
        </Markdown>
      </div>
    </section>
  );
}
