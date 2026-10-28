import { Link, useParams, useSearch } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/controls";
import { UnknownMark } from "@/components/marks";
import { toolPage } from "@/components/page";
import { AbilitiesFrame } from "@/components/page-frames";
import { MonSprite } from "@/components/pc/mon-sprite";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { abilitiesPage, type AbilitiesPage as Page, type AbilityEntry, type AbilityHolder, type AbilityTrainer } from "../../shared/abilities";

const FROM = "/series/$number/abilities";

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type Show = "all" | "current";

type Listed = AbilityEntry & { id: string; count: number };

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function holderOf(mon: AbilityHolder, ability: string) {
  return mon.abilities.find((a) => a.id === ability);
}

export function AbilitiesPage() {
  const { number } = useParams({ from: FROM });
  const { ability } = useSearch({ from: FROM });
  const wide = useMediaQuery("(min-width: 64rem)");
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    api(`/series/${encodeURIComponent(number)}/abilities`, abilitiesPage).then(
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
  }, [number]);

  const listed = useMemo<Listed[]>(() => {
    if (!page) return [];
    const counts = new Map<string, number>();
    for (const trainer of page.trainers) for (const mon of trainer.mons) for (const a of mon.abilities) counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
    return Object.entries(page.abilities)
      .map(([id, entry]) => ({ id, ...entry, count: counts.get(id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [page]);

  if (error) {
    return (
      <main className={cn(toolPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!page) return <AbilitiesFrame />;

  return (
    <main className={cn(toolPage, "gap-4.5 pt-5 pb-6 lg:max-h-[calc(100svh-4rem)] lg:min-h-144")}>
      <div className="flex min-w-0 flex-col gap-2">
        <nav aria-label="Breadcrumb" className="flex font-heading text-[1.375rem]">
          <Link to="/series/$number" params={{ number: String(page.series.number) }} className={cn("-my-2.5 flex min-h-11 items-center gap-2 text-primary decoration-2 underline-offset-4 hover:underline", focus)}>
            <svg viewBox="0 0 14 18" aria-hidden="true" className="h-3 w-2 fill-current">
              <path d="M12 2L2 9l10 7z" />
            </svg>
            Series {page.series.number}
          </Link>
        </nav>
        <h1 className="m-0 font-heading text-5xl leading-[0.85] font-normal sm:text-6xl">Abilities</h1>
      </div>
      <div className="flex flex-1 gap-6 pb-3 sm:pb-6 lg:min-h-0">
        {(wide || ability === undefined) && <AbilityList number={number} listed={listed} picked={ability} />}
        {(wide || ability !== undefined) && <Holders number={number} page={page} ability={ability} back={!wide} />}
      </div>
    </main>
  );
}

function AbilityList({ number, listed, picked }: { number: string; listed: readonly Listed[]; picked: string | undefined }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? listed.filter((a) => a.name.toLowerCase().includes(q)) : listed;
  return (
    <section aria-label="Abilities" className="flex min-w-0 flex-col gap-3 rounded-[18px] border-3 bg-card p-3.5 max-lg:flex-1 lg:min-h-0 lg:w-95 lg:flex-none">
      <span className="min-h-8 pl-1 font-heading text-[1.875rem] leading-none">{q ? `${shown.length} of ${listed.length} abilities` : `${listed.length} abilities`}</span>
      <label className="flex h-12 flex-none items-center gap-2 rounded-[10px] border-3 bg-ink px-3 focus-within:border-primary">
        <Search className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Search abilities</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-3 border-cell bg-box">
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto overscroll-contain p-1">
          {shown.map((a) => (
            <li key={a.id}>
              <Link
                to={FROM}
                params={{ number }}
                search={{ ability: a.id }}
                aria-current={a.id === picked ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-3 text-[0.9375rem] font-bold",
                  focus,
                  a.id === picked ? "bg-cell text-white" : "text-subtle hover:bg-cell hover:text-white",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {a.name}
                  {a.marked && <UnknownMark />}
                </span>
                <span className="flex-none font-heading text-xl font-normal text-muted-foreground tabular-nums">{a.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="my-10 text-center font-heading text-[1.625rem] text-prose">{listed.length === 0 ? "No snapshot yet" : "Nothing matches"}</p>}
      </div>
    </section>
  );
}

function Holders({ number, page, ability, back }: { number: string; page: Page; ability: string | undefined; back: boolean }) {
  const { data } = authClient.useSession();
  const [show, setShow] = useState<Show>("all");
  const you = data?.user.id;
  const entry = ability === undefined ? undefined : page.abilities[ability];
  const groups = useMemo(() => {
    if (ability === undefined) return [];
    const rank = (mon: AbilityHolder) => (holderOf(mon, ability)?.current ? 0 : 1);
    return page.trainers
      .map((trainer) => ({
        trainer,
        all: trainer.mons
          .filter((mon) => holderOf(mon, ability))
          .sort((a, b) => rank(a) - rank(b) || (b.level ?? 0) - (a.level ?? 0)),
      }))
      .filter((group) => group.all.length > 0)
      .sort((a, b) => Number(b.trainer.player.id === you) - Number(a.trainer.player.id === you));
  }, [page, ability, you]);
  const total = groups.reduce((sum, g) => sum + g.all.length, 0);
  const inUse = groups.reduce((sum, g) => sum + g.all.filter((mon) => holderOf(mon, ability ?? "")?.current).length, 0);
  const shown = groups
    .map((g) => ({ ...g, mons: show === "all" ? g.all : g.all.filter((mon) => holderOf(mon, ability ?? "")?.current) }))
    .filter((g) => g.mons.length > 0);

  return (
    <section aria-labelledby="holders-title" className="flex min-w-0 flex-1 flex-col gap-4 rounded-[18px] border-3 bg-card p-3.5 sm:p-5 lg:min-h-0">
      {back && (
        <Link to={FROM} params={{ number }} search={{}} className={cn("-my-1 flex min-h-11 w-fit items-center gap-1.5 rounded-lg font-heading text-[1.375rem] text-primary decoration-2 underline-offset-4 hover:underline", focus)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          All abilities
        </Link>
      )}
      {ability === undefined ? (
        <p id="holders-title" className="m-0 grid flex-1 place-items-center rounded-2xl border-3 border-dashed border-cell-hi bg-box px-5 py-10 text-center font-heading text-3xl text-subtle">
          No ability picked
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-2">
              <h2 id="holders-title" className="m-0 font-heading text-[2.625rem] leading-[0.85] font-normal">
                {entry?.name ?? ability}
                {entry?.marked && <UnknownMark />}
              </h2>
              <p className="m-0 max-w-160 text-sm leading-relaxed text-subtle">{entry?.desc || "—"}</p>
            </div>
            <Segmented
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: "all", label: `Can have · ${total}` },
                { value: "current", label: `In use · ${inUse}` },
              ]}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain">
            {shown.map((g) => (
              <TrainerGroup key={g.trainer.player.id} number={number} trainer={g.trainer} mons={g.mons} ability={ability} you={g.trainer.player.id === you} />
            ))}
            {shown.length === 0 && (
              <p className="m-0 rounded-2xl border-3 border-dashed border-cell-hi bg-box px-5 py-10 text-center font-heading text-3xl text-subtle">
                {show === "all" ? "Nobody has it" : "Nobody has it in use"}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function TrainerGroup({ number, trainer, mons, ability, you }: { number: string; trainer: AbilityTrainer; mons: readonly AbilityHolder[]; ability: string; you: boolean }) {
  const id = `holders-${trainer.player.id}`;
  return (
    <section aria-labelledby={id} className="flex flex-none flex-col gap-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <PlayerBadge name={trainer.player.name} colour={playerColour(trainer.player.name)} size="sm" />
        <h3 id={id} className="m-0 truncate font-heading text-[1.75rem] leading-none font-normal">
          {trainer.player.name}
        </h3>
        {you && <span className="flex-none rounded-sm bg-yellow px-2 font-heading text-lg text-ink">You</span>}
        <span className="truncate font-heading text-xl text-muted-foreground">{trainer.milestone}</span>
        <span className="flex-1" />
        <span className="flex-none font-heading text-xl text-muted-foreground tabular-nums">{mons.length}</span>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]">
        {mons.map((mon) => {
          const held = holderOf(mon, ability);
          return (
            <li key={mon.index}>
              <Link
                to="/players/$player/series/$number/pc"
                params={{ player: trainer.player.id, number }}
                search={{ snapshot: trainer.milestone, mon: mon.index }}
                aria-label={`${mon.name}, ${mon.species}, level ${mon.level ?? "unknown"}${held?.current ? ", in use" : ""}${held?.hidden ? ", hidden" : ""}, in ${trainer.player.name}'s PC`}
                className={cn("flex min-h-19 items-center gap-3 rounded-xl border-3 border-cell bg-box py-1 pr-3 pl-1 hover:border-primary", focus)}
              >
                <span className="grid size-16 flex-none place-items-center overflow-hidden rounded-lg bg-pc-cell">
                  <MonSprite mon={mon} className="size-16" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-heading text-2xl leading-none">{mon.name}</span>
                  <span className="truncate font-heading text-lg leading-none text-muted-foreground">
                    {mon.name !== mon.species && `${mon.species} · `}Lv {mon.level ?? "?"}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  {held?.current && <span className="rounded-md bg-cyan px-2 py-0.5 font-heading text-base leading-5 text-ink">In use</span>}
                  {held?.hidden && <span className="rounded-md border-2 border-cell-hi px-1.5 font-heading text-base leading-5 text-subtle">Hidden</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
