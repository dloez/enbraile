import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Segmented } from "@/components/controls";
import { toolPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { SnapshotPc } from "@/components/pc/pc-box";
import { type PcPage as Pc, pcPage } from "../../shared/pc";

const FROM = "/players/$player/series/$number/pc";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function PcPage() {
  const { player, number } = useParams({ from: FROM });
  const { snapshot } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const [page, setPage] = useState<Pc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    const query = snapshot === undefined ? "" : `?snapshot=${encodeURIComponent(snapshot)}`;
    api(`/series/${encodeURIComponent(number)}/trainers/${encodeURIComponent(player)}/pc${query}`, pcPage).then(
      (next) => live && setPage(next),
      (caught: unknown) => {
        if (!live) return;
        setPage(null);
        setError(message(caught));
      },
    );
    return () => {
      live = false;
    };
  }, [player, number, snapshot]);

  if (error) {
    return (
      <main className={cn(toolPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!page) return <main className={toolPage} />;

  function pick(milestone: string) {
    void navigate({ to: FROM, params: { player, number }, search: { snapshot: milestone } });
  }

  return (
    <main className={cn(toolPage, "pt-5 lg:max-h-[calc(100svh-4rem)] lg:min-h-176")}>
      <PcHead page={page} onPick={pick} />
      {page.snapshot ? (
        <SnapshotPc key={page.milestone} sheet={page.snapshot} gaps={page.missing?.missing ?? []} />
      ) : (
        <p className="my-6 rounded-2xl border-3 border-dashed border-cell-hi bg-box px-5 py-10 text-center font-heading text-3xl text-subtle">
          No snapshot yet
        </p>
      )}
    </main>
  );
}

function PcHead({ page, onPick }: { page: Pc; onPick: (milestone: string) => void }) {
  const { data } = authClient.useSession();
  const you = data?.user.id === page.player.id;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <nav aria-label="Breadcrumb" className="flex font-heading text-[1.375rem]">
          <Link
            to="/players/$player/series/$number"
            params={{ player: page.player.id, number: String(page.series.number) }}
            aria-label={`${page.player.name} in Series ${page.series.number}`}
            className="-my-2.5 flex min-h-11 items-center gap-2 text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <svg viewBox="0 0 14 18" aria-hidden="true" className="h-3 w-2 fill-current">
              <path d="M12 2L2 9l10 7z" />
            </svg>
            {page.player.name}
          </Link>
          <span aria-hidden="true" className="mx-2 self-center text-faint">
            ·
          </span>
          <Link to="/series/$number" params={{ number: String(page.series.number) }} className="-my-2.5 flex min-h-11 items-center gap-2 text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
            Series {page.series.number}
          </Link>
        </nav>
        <div className="flex min-w-0 items-center gap-3.5">
          <Link to="/players/$player" params={{ player: page.player.id }} aria-label={`${page.player.name}'s profile`} className="flex-none rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <PlayerBadge name={page.player.name} colour={playerColour(page.player.id)} size="lg" />
          </Link>
          <h1 className="m-0 truncate font-heading text-5xl leading-[0.85] font-normal sm:text-6xl">{page.player.name}'s PC</h1>
          {you && <span className="rounded-sm bg-yellow px-2 font-heading text-lg text-ink">You</span>}
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex max-w-full flex-col items-end gap-2 max-sm:items-start">
        <Segmented
          label="Snapshot"
          size="lg"
          className="max-w-full flex-wrap"
          options={page.milestones.map((m) => ({ value: m.name, label: m.name, disabled: !m.taken }))}
          value={page.milestone ?? ""}
          onChange={onPick}
        />
      </div>
    </div>
  );
}
