import { Link } from "@tanstack/react-router";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { buttonClass, fieldClass, Panel } from "@/components/controls";
import { listPage } from "@/components/page";
import { api } from "@/lib/api";
import { sendFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { AdminGate } from "@/pages/admin";
import { downloadLink, game, gameList, type Game } from "../../shared/games";

const sizeUnits = ["B", "KB", "MB", "GB"];

function formatSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < sizeUnits.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${sizeUnits[unit]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function AdminGamesPage() {
  return (
    <AdminGate>
      <AdminGames />
    </AdminGate>
  );
}

function AdminGames() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGames(await api("/games", gameList));
    } catch (caught) {
      setError(message(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (updated: Game) => setGames((current) => current?.map((g) => (g.id === updated.id ? updated : g)) ?? null);

  return (
    <main className={cn(listPage, "gap-7 py-7 sm:py-9")}>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 flex-1 font-heading text-5xl leading-none sm:text-6xl">Games</h1>
        <Link to="/admin" className={buttonClass}>
          Admin
        </Link>
      </div>
      <NewGame onCreated={(created) => setGames((current) => [...(current ?? []), created])} />
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      {games?.map((g) => (
        <GameRow key={g.id} game={g} onChange={replace} />
      ))}
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
    <Panel title="New game">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          Name
          <input
            name="name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={cn(fieldClass, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
          />
        </label>
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={cn(buttonClass, "self-start")}>
          Create
        </button>
      </form>
    </Panel>
  );
}

function GameRow({ game: current, onChange }: { game: Game; onChange: (updated: Game) => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
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

  return (
    <Panel
      title={current.name}
      aside={
        current.fileSize !== null && current.uploadedAt ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatSize(current.fileSize)} · {formatDate(current.uploadedAt)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No file</span>
        )
      }
    >
      {current.fileName && <p className="m-0 text-sm break-all">{current.fileName}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cn(
            buttonClass,
            "relative focus-within:ring-3 focus-within:ring-ring/50",
            uploading && "pointer-events-none opacity-50",
          )}
        >
          {current.fileName ? "Replace" : "Upload"}
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
        {current.fileName && (
          <button type="button" disabled={uploading} onClick={() => void download()} className={buttonClass}>
            Download
          </button>
        )}
        {uploading && (
          <span role="status" className="font-heading text-2xl tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </Panel>
  );
}
