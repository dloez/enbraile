import { type FormEvent, useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { buttonClass, formFieldClass, formLabelClass } from "@/components/controls";
import { adminPage, AdminGamesFrame } from "@/components/page-frames";
import { PixelIcon } from "@/components/pixel-icon";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatSize, joinedOn } from "@/lib/admin-format";
import { sendFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { downloadLink, game, gameCosts, gameList, MAX_COST, type Game } from "../../shared/games";
import { type AdminSeries, adminSeriesList } from "../../shared/series";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function AdminGamesPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [series, setSeries] = useState<AdminSeries[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api("/games", gameList), api("/admin/series", adminSeriesList)]).then(
      ([gameRows, seriesRows]) => {
        setGames(gameRows);
        setSeries(seriesRows);
      },
      (caught: unknown) => setError(message(caught)),
    );
  }, []);

  if (!games && !error) return <AdminGamesFrame />;
  const replace = (updated: Game) => setGames((current) => current?.map((g) => (g.id === updated.id ? updated : g)) ?? null);

  return (
    <main className={adminPage}>
      <h1 className="sr-only">Admin games</h1>
      <AdminNav />
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {games && (
        <>
          <NewGame onCreated={(created) => setGames((current) => [...(current ?? []), created])} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
            {games.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                usedBy={series
                  .filter((s) => s.gameId === g.id)
                  .map((s) => s.number)
                  .sort((a, b) => a - b)}
                onChange={replace}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function NewGame({ onCreated }: { onCreated: (created: Game) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await api("/games", game, { body: { name } }));
      setName("");
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border-3 bg-card px-4 pt-3.5 pb-4 sm:flex-row sm:items-end sm:gap-3.5 sm:px-5 sm:pt-4 sm:pb-4.5">
      <h2 className="m-0 font-heading text-[1.75rem] leading-none font-normal sm:mr-1.5 sm:self-center sm:text-3xl">New game</h2>
      <label className={cn(formLabelClass, "flex-1")}>
        Name
        <input
          name="name"
          required
          maxLength={100}
          placeholder="As players will see it, e.g. Pokémon Añil · Randomlocke"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={formFieldClass}
        />
      </label>
      <button type="submit" disabled={busy} className={buttonVariants({ variant: "go", className: "min-h-11.5 px-5 text-[1.625rem]" })}>
        <PixelIcon name="plus" className="size-3.5" />
        Create
      </button>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive sm:self-center">
          {error}
        </p>
      )}
    </form>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex min-w-0 flex-col rounded-[10px] bg-box px-3 py-2">
      <span className="font-heading text-base text-muted-foreground sm:text-[1.0625rem]">{label}</span>
      <span className="truncate font-heading text-[1.375rem] leading-none sm:text-[1.625rem]">{value}</span>
    </span>
  );
}

function GameCard({ game: current, usedBy, onChange }: { game: Game; usedBy: number[]; onChange: (updated: Game) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [sending, setSending] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setSending(file.name);
    setProgress(0);
    try {
      onChange(await sendFile(`/games/${current.id}`, file, game, setProgress));
    } catch (caught) {
      setError(message(caught));
    }
    setProgress(null);
  }

  async function download() {
    setError(null);
    try {
      const { url } = await api(`/games/${current.id}/download`, downloadLink);
      window.location.assign(url);
    } catch (caught) {
      setError(message(caught));
    }
  }

  const uploading = progress !== null;
  const hasFile = current.fileName !== null;

  return (
    <article className={cn("flex flex-col gap-4 rounded-2xl border-3 bg-card p-4 sm:px-6 sm:py-5.5", uploading && "border-primary")}>
      <div className="flex items-center gap-4 sm:gap-4.5">
        <PixelIcon name="cartridge" className={cn("size-13 sm:size-16", !hasFile && "opacity-45")} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="m-0 font-heading text-3xl leading-[0.95] font-normal sm:text-4xl">{current.name}</h2>
          <span className={cn("text-[0.8125rem] font-bold break-all sm:text-sm", hasFile ? "text-subtle" : "text-warning")}>{current.fileName ?? "No file"}</span>
        </div>
      </div>
      {hasFile && current.fileSize !== null && current.uploadedAt ? (
        <div className="grid grid-cols-3 gap-2">
          <Fact label="Size" value={formatSize(current.fileSize)} />
          <Fact label="Uploaded" value={joinedOn(current.uploadedAt)} />
          <Fact label="Used by" value={usedBy.length ? `Series ${usedBy.join(", ")}` : "No series"} />
        </div>
      ) : (
        !uploading && (
          <div className="flex min-h-16.5 items-center gap-3 rounded-xl border-3 border-dashed border-cell-hi px-4 text-[0.8125rem] text-subtle sm:text-sm">
            <PixelIcon name="alert" className="size-5 text-warning" />
            No zip yet. A series can't start on this game until it has one.
          </div>
        )
      )}
      {uploading && (
        <div role="status" className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 font-heading text-xl">
            <span className="truncate text-subtle">Uploading {sending}</span>
            <span className="tabular-nums">{Math.round(progress * 100)}%</span>
          </div>
          <span className="block h-3 overflow-hidden rounded-md bg-ink">
            <span className="block h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">Sent in parts; a dropped part is retried on its own. Leaving the page stops it.</span>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      <CostsForm game={current} onChange={onChange} />
      <div className="flex flex-wrap items-center gap-2.5">
        <label
          className={cn(
            buttonVariants({ variant: hasFile ? "default" : "go", className: "relative px-4.5 text-2xl focus-within:ring-3 focus-within:ring-ring/50" }),
            uploading && "pointer-events-none opacity-45",
          )}
        >
          <PixelIcon name="upload" className="size-4" />
          {hasFile ? "Replace zip" : "Upload zip"}
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={uploading}
            aria-label={`Upload the zip of ${current.name}`}
            className="absolute size-px opacity-0"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {hasFile && (
          <button type="button" disabled={uploading} onClick={() => void download()} className={cn(buttonClass, "px-4.5")}>
            <PixelIcon name="download" className="size-4" />
            Download
          </button>
        )}
      </div>
    </article>
  );
}

function CostsForm({ game: current, onChange }: { game: Game; onChange: (updated: Game) => void }) {
  const [setas, setSetas] = useState(String(current.costs.abilitySetas));
  const [price, setPrice] = useState(String(current.costs.mintPrice));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = gameCosts.safeParse({ abilitySetas: Number(setas), mintPrice: Number(price) });
  const valid = setas.trim() !== "" && price.trim() !== "" && input.success;
  const changed = valid && (input.data.abilitySetas !== current.costs.abilitySetas || input.data.mintPrice !== current.costs.mintPrice);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.success) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await api(`/games/${current.id}/costs`, game, { method: "PUT", body: input.data }));
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} aria-label={`Team builder costs of ${current.name}`} className="flex flex-col gap-2.5 rounded-xl bg-box px-3.5 pt-2.5 pb-3.5">
      <h3 className="m-0 font-heading text-[1.375rem] leading-none font-normal text-subtle">Team builder costs</h3>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className={cn(formLabelClass, "flex-[1_1_9rem]")}>
          Mini Setas per ability
          <input
            inputMode="numeric"
            value={setas}
            onChange={(event) => setSetas(event.target.value)}
            aria-invalid={!valid && setas.trim() !== ""}
            className={formFieldClass}
          />
        </label>
        <label className={cn(formLabelClass, "flex-[1_1_9rem]")}>
          Money per mint
          <input
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-invalid={!valid && price.trim() !== ""}
            className={formFieldClass}
          />
        </label>
        <button type="submit" disabled={busy || !changed} className={cn(buttonClass, "min-h-11.5 px-4.5")}>
          Save
        </button>
      </div>
      <p className="m-0 text-[0.8125rem] text-muted-foreground">
        What the team builder charges a snapshot's Pokémon for a new ability and for a new nature, a mint of that nature from the bag first. 0 to 99 Mini Setas, 0 to {MAX_COST.toLocaleString("en")} money.
      </p>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
