import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/controls";
import { toolPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { GameIconsProvider } from "@/lib/item-icons";
import { cn } from "@/lib/utils";
import { PcFrame } from "@/components/page-frames";
import { SnapshotPc } from "@/components/pc/pc-box";
import { AddToTeam, useOwnTeams } from "@/teams/components/add-to-team";
import { unpackPc } from "../../shared/mon";
import { localizePc } from "../../shared/describe";
import { messages } from "../../shared/i18n";
import { type PcPage as Pc, pcPage } from "../../shared/pc";

const t = messages({
  en: {
    failed: "Something went wrong",
    noSnapshot: "No snapshot yet",
    breadcrumb: "Breadcrumb",
    inSeries: (name: string, n: number) => `${name} in Series ${n}`,
    series: (n: number) => `Series ${n}`,
    profile: (name: string) => `${name}'s profile`,
    pc: (name: string) => `${name}'s PC`,
    you: "You",
    snapshot: "Snapshot",
  },
  es: {
    failed: "Algo ha salido mal",
    noSnapshot: "Aún no hay capturas",
    breadcrumb: "Ruta de navegación",
    inSeries: (name: string, n: number) => `${name} en la serie ${n}`,
    series: (n: number) => `Serie ${n}`,
    profile: (name: string) => `Perfil de ${name}`,
    pc: (name: string) => `PC de ${name}`,
    you: "Tú",
    snapshot: "Captura",
  },
});

const FROM = "/players/$player/series/$number/pc";

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

export function PcPage() {
  const { player, number } = useParams({ from: FROM });
  const { snapshot, mon } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data } = authClient.useSession();
  const [page, setPage] = useState<Pc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = data?.user && !data.user.admin && data.user.id === player ? player : null;
  const teams = useOwnTeams(mine, page?.snapshotId ?? null);
  const mons = useMemo(() => (page?.pc ? unpackPc(page.pc) : null), [page]);

  useEffect(() => {
    let live = true;
    setError(null);
    const query = snapshot === undefined ? "" : `?snapshot=${encodeURIComponent(snapshot)}`;
    api(`/series/${encodeURIComponent(number)}/trainers/${encodeURIComponent(player)}/pc${query}`, pcPage).then(
      (next) => live && setPage({ ...next, pc: next.pc && localizePc(next.pc) }),
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
  if (!page) return <PcFrame />;
  const builds = mine ? page.snapshotId : null;

  function pick(milestone: string) {
    void navigate({ to: FROM, params: { player, number }, search: { snapshot: milestone } });
  }

  return (
    <main className={cn(toolPage, "pt-5 lg:max-h-[calc(var(--screen-h)-4rem)] lg:min-h-144")}>
      <PcHead page={page} onPick={pick} />
      {page.pc && mons ? (
        <GameIconsProvider game={page.series.gameId}>
          <SnapshotPc
            key={page.milestone}
            mons={mons}
            series={page.series.number}
            initial={mon}
            items={page.pc.items}
            setas={page.pc.setas}
            money={page.pc.money}
            tms={page.pc.tms}
            gaps={page.missing?.missing ?? []}
            footer={builds ? (mon) => (mon.fainted ? null : <AddToTeam mon={mon} snapshot={builds} teams={teams} className="px-4.5 py-3.5" />) : undefined}
          />
        </GameIconsProvider>
      ) : (
        <p className="my-6 rounded-2xl border-3 border-dashed border-cell-hi bg-box px-5 py-10 text-center font-heading text-3xl text-subtle">
          {t.noSnapshot}
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
        <nav aria-label={t.breadcrumb} className="flex font-heading text-[1.375rem]">
          <Link
            to="/players/$player/series/$number"
            params={{ player: page.player.id, number: String(page.series.number) }}
            aria-label={t.inSeries(page.player.name, page.series.number)}
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
            {t.series(page.series.number)}
          </Link>
        </nav>
        <div className="flex min-w-0 items-center gap-3.5">
          <Link to="/players/$player" params={{ player: page.player.id }} aria-label={t.profile(page.player.name)} className="flex-none rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <PlayerBadge name={page.player.name} colour={playerColour(page.player.name)} size="lg" />
          </Link>
          <h1 className="m-0 truncate font-heading text-5xl leading-[0.85] font-normal sm:text-6xl">{t.pc(page.player.name)}</h1>
          {you && <span className="rounded-sm bg-yellow px-2 font-heading text-lg text-ink">{t.you}</span>}
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex max-w-full flex-col items-end gap-2 max-sm:items-start">
        <Segmented
          label={t.snapshot}
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
