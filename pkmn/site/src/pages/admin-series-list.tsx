import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { buttonClass, fieldClass, liftCardClass, Panel } from "@/components/controls";
import { listPage } from "@/components/page";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminGate } from "@/pages/admin";
import { type AdminSeries, adminSeries, adminSeriesList } from "../../shared/series";

export const STATE_NAMES: Record<AdminSeries["state"], string> = { draft: "Draft", running: "Playing now", finished: "Finished" };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function AdminSeriesListPage() {
  return (
    <AdminGate>
      <AdminSeriesList />
    </AdminGate>
  );
}

function AdminSeriesList() {
  const [list, setList] = useState<AdminSeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/admin/series", adminSeriesList).then(setList, (caught: unknown) => setError(message(caught)));
  }, []);

  const next = Math.max(0, ...(list ?? []).map((s) => s.number)) + 1;

  return (
    <main className={cn(listPage, "gap-7 py-7 sm:py-9")}>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 flex-1 font-heading text-5xl leading-none sm:text-6xl">Series</h1>
        <Link to="/admin" className={buttonClass}>
          Admin
        </Link>
      </div>
      {list && <NewSeries key={next} next={next} />}
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
      {list?.map((s) => (
        <Link key={s.id} to="/admin/series/$id" params={{ id: s.id }} className={cn(liftCardClass, "flex items-center gap-3 px-5 py-4.5")}>
          <span className="flex-1 font-heading text-4xl">{s.name}</span>
          <span className={cn("font-heading text-2xl", s.state === "running" ? "text-primary" : "text-muted-foreground")}>
            {STATE_NAMES[s.state]}
          </span>
          <ArrowRight className="size-6 text-primary" aria-hidden="true" />
        </Link>
      ))}
    </main>
  );
}

function NewSeries({ next }: { next: number }) {
  const navigate = useNavigate();
  const [number, setNumber] = useState(String(next));
  const [name, setName] = useState(`Series ${next}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api("/admin/series", adminSeries, { body: { number: Number(number), name } });
      await navigate({ to: "/admin/series/$id", params: { id: created.id } });
    } catch (caught) {
      setError(message(caught));
      setBusy(false);
    }
  }

  return (
    <Panel title="New series">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            Number
            <input
              name="number"
              type="number"
              required
              min={1}
              max={999}
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              className={cn(fieldClass, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
            />
          </label>
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
        </div>
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={cn(buttonClass, "self-start")}>
          Create draft
        </button>
      </form>
    </Panel>
  );
}
