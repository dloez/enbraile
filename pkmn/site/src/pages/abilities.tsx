import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/controls";
import { toolPage } from "@/components/page";
import { PcFrame } from "@/components/page-frames";
import { PcBox, SummaryAside, SummarySheet } from "@/components/pc/pc-box";
import { Placeholder } from "@/components/placeholder";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SelectField } from "@/components/select-field";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { abilitiesPage, type AbilitiesPage as Page, type AbilityHolder, type AbilityTrainer } from "../../shared/abilities";
import { unpackPc, type BagTm, type Mon } from "../../shared/mon";
import { localizeHolders, localizePc } from "../../shared/describe";
import { messages } from "../../shared/i18n";
import { pcPage } from "../../shared/pc";
import type { ExportGap } from "../../shared/snapshot";

const t = messages({
  en: {
    failed: "Something went wrong",
    pcAt: (name: string, milestone: string) => `${name}'s PC · ${milestone}`,
    breadcrumb: "Breadcrumb",
    series: (n: number) => `Series ${n}`,
    title: "Abilities",
    trainer: "Trainer",
    allTrainers: "All trainers",
    noPick: "No Pokémon picked",
  },
  es: {
    failed: "Algo ha salido mal",
    pcAt: (name: string, milestone: string) => `PC de ${name} · ${milestone}`,
    breadcrumb: "Ruta de navegación",
    series: (n: number) => `Serie ${n}`,
    title: "Habilidades",
    trainer: "Entrenador",
    allTrainers: "Todos los entrenadores",
    noPick: "Ningún Pokémon elegido",
  },
});

const FROM = "/series/$number/abilities";

type SeriesMon = AbilityHolder & { fainted: boolean; own: number; trainer: AbilityTrainer };

type Held = { mons: Mon[]; tms: BagTm[]; gaps: ExportGap[] };

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

export function AbilitiesPage() {
  const { number } = useParams({ from: FROM });
  const { ability } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const wide = useMediaQuery("(min-width: 64rem)");
  const { data } = authClient.useSession();
  const you = data?.user.id;
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trainer, setTrainer] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [held, setHeld] = useState<Record<string, Held>>({});

  useEffect(() => {
    let live = true;
    setError(null);
    api(`/series/${encodeURIComponent(number)}/abilities`, abilitiesPage).then(
      (next) => live && setPage({ ...next, trainers: next.trainers.map((t) => ({ ...t, mons: localizeHolders(t.mons) })) }),
      (caught: unknown) => {
        if (!live) return;
        setPage(null);
        setError(message(caught));
      },
    );
    return () => {
      live = false;
    };
  }, [number]);

  const mons = useMemo<SeriesMon[]>(() => {
    if (!page) return [];
    const trainers = [...page.trainers].sort((a, b) => Number(b.player.id === you) - Number(a.player.id === you));
    let at = 0;
    return trainers.flatMap((t) => t.mons.map((m) => ({ ...m, index: at++, own: m.index, fainted: false, trainer: t })));
  }, [page, you]);

  const selected = mons.find((m) => m.index === picked);
  const owner = selected?.trainer;
  const full = owner && held[owner.player.id];
  const summary = selected && full ? full.mons[selected.own] : undefined;

  useEffect(() => {
    if (!owner || held[owner.player.id]) return;
    let live = true;
    const id = owner.player.id;
    api(`/series/${encodeURIComponent(number)}/trainers/${encodeURIComponent(id)}/pc?snapshot=${encodeURIComponent(owner.milestone)}`, pcPage).then(
      (next) => {
        if (!live || !next.pc) return;
        const pc = localizePc(next.pc);
        setHeld((now) => ({ ...now, [id]: { mons: unpackPc(pc), tms: pc.tms, gaps: next.missing?.missing ?? [] } }));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [owner, held, number]);

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

  const series = page.series.number;
  const chooseAbility = (next: string) => void navigate({ to: FROM, params: { number }, search: next ? { ability: next } : {}, replace: true });
  const footer = selected && (
    <div className="flex-none border-t-3 px-4.5 py-3.5">
      <Link
        to="/players/$player/series/$number/pc"
        params={{ player: selected.trainer.player.id, number }}
        search={{ snapshot: selected.trainer.milestone, mon: selected.own }}
        className={cn(buttonClass, "w-full justify-start gap-3")}
      >
        <PlayerBadge name={selected.trainer.player.name} colour={playerColour(selected.trainer.player.name)} size="xs" />
        <span className="min-w-0 flex-1 truncate text-left">
          {t.pcAt(selected.trainer.player.name, selected.trainer.milestone)}
        </span>
        <ArrowRight className="size-4 flex-none text-primary" aria-hidden="true" />
      </Link>
    </div>
  );

  return (
    <main className={cn(toolPage, "pt-5 lg:max-h-[calc(var(--screen-h)-4rem)] lg:min-h-144")}>
      <div className="flex min-w-0 flex-col gap-2">
        <nav aria-label={t.breadcrumb} className="flex font-heading text-[1.375rem]">
          <Link
            to="/series/$number"
            params={{ number: String(series) }}
            className="-my-2.5 flex min-h-11 items-center gap-2 text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <svg viewBox="0 0 14 18" aria-hidden="true" className="h-3 w-2 fill-current">
              <path d="M12 2L2 9l10 7z" />
            </svg>
            {t.series(series)}
          </Link>
        </nav>
        <h1 className="m-0 font-heading text-5xl leading-[0.85] font-normal sm:text-6xl">{t.title}</h1>
      </div>
      <div className="flex flex-1 gap-6 pt-3.5 pb-3 sm:pb-6 lg:min-h-0">
        <PcBox
          mons={mons}
          selected={picked}
          onPick={setPicked}
          ability={ability ?? ""}
          onAbility={chooseAbility}
          filter={(mon) => !trainer || mon.trainer.player.id === trainer}
          mark={(mon) => <PlayerBadge name={mon.trainer.player.name} colour={playerColour(mon.trainer.player.name)} size="cell" />}
          filters={
            <SelectField
              label={t.trainer}
              value={trainer}
              onChange={setTrainer}
              all={t.allTrainers}
              options={page.trainers.map((t) => ({ value: t.player.id, label: t.player.name }))}
            />
          }
        />
        {wide &&
          (summary ? (
            <SummaryAside mon={summary} tms={full?.tms ?? []} gaps={full?.gaps} series={series} footer={footer} />
          ) : selected ? (
            <Placeholder className="w-95 flex-none rounded-[18px]" />
          ) : (
            <p className="m-0 grid w-95 flex-none place-items-center rounded-[18px] border-3 border-dashed border-cell-hi bg-box px-5 text-center font-heading text-3xl text-subtle">
              {t.noPick}
            </p>
          ))}
      </div>
      {!wide && <SummarySheet mon={summary} tms={full?.tms ?? []} gaps={full?.gaps} series={series} open={summary !== undefined} onClose={() => setPicked(null)} footer={footer} />}
    </main>
  );
}
