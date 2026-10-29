import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { toolPage } from "@/components/page";
import type { TeamsSearch } from "@/router";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { api, ApiError } from "@/lib/api";
import { teamPage } from "@/lib/lazy-pages";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { TwoBlocks } from "@/components/page-frames";
import { spriteOfName } from "@/analysis/sprite";
import { SnapshotMenu } from "@/teams/components/snapshot-menu";
import { cupStage } from "@/league/cup";
import { profilePage } from "../../shared/profile";
import {
  MAX_COMPARED,
  MIN_COMPARED,
  TEAM_KINDS,
  TEAM_STATES,
  hasToggle,
  teamKind,
  teamList,
  teamMade,
  teamWaits,
  type TeamKind,
  type TeamLeague,
  type TeamRow,
  type TeamState,
  type TeamWait,
} from "../../shared/team";
import { locale, messages } from "../../shared/i18n";

const t = messages({
  en: {
    failed: "Something went wrong",
    changedOn: (when: string) => `Changed ${when}`,
    loggedOn: (when: string) => `Logged ${when}`,
    lockedOn: (when: string) => `Locked ${when}`,
    today: "today",
    yesterday: "yesterday",
    daysAgo: (days: number) => `${days} days ago`,
    inMonth: (month: string) => `in ${month}`,
    any: "Any Pokémon",
    noSource: "No source",
    series: (n: number | string) => `Series ${n}`,
    theirs: (player: string, milestone: string) => `${player}'s ${milestone}`,
    snapshots: (n: number) => `${n} snapshots`,
    title: "Teams",
    picked: (n: number) => `${n} picked`,
    cancel: "Cancel",
    compareTeams: "Compare teams",
    compare: "Compare",
    newTeam: "New team",
    startFrom: "Start from",
    orStart: (reason: string) => `${reason}. Or start from:`,
    yours: "Yours",
    others: "Other trainers",
    every: "Every team",
    empty: "No teams yet",
    noMatch: "No teams match these filters",
    filters: "Filters",
    filterTeams: "Filter teams",
    seriesFilter: "Series",
    kindFilter: "Kind",
    stateFilter: "State",
    ownerFilter: "Owner",
    allSeries: "All",
    allKinds: "All",
    allStates: "All",
    everyone: "Everyone",
    you: (name: string) => `${name} (you)`,
    kinds: { free: "Free", round: "Round", cup: "Cup", try: "League try" } satisfies Record<TeamKind, string>,
    states: { todo: "To build", locked: "Locked", edit: "Editable" } satisfies Record<TeamState, string>,
    leagueTry: (n: number) => `League try ${n}`,
    cupMatch: (stage: string, opponent: string) => `Cup · ${stage} v ${opponent}`,
    roundMatch: (round: number, opponent: string | null) => (opponent ? `Round ${round} v ${opponent}` : `Round ${round}`),
    waiting: (milestone: string) => `Reach ${milestone} and upload its snapshot to get your team`,
    toSeries: "Upload it on the series page",
    private: "Private",
    privateTitle: "Only you and admins see it",
    shown: (n: number) => (n === 1 ? "1 team" : `${n} teams`),
    clearFilters: "Clear filters",
    clear: "Clear",
  },
  es: {
    failed: "Algo ha fallado",
    changedOn: (when: string) => `Cambiado ${when}`,
    loggedOn: (when: string) => `Anotado ${when}`,
    lockedOn: (when: string) => `Bloqueado ${when}`,
    today: "hoy",
    yesterday: "ayer",
    daysAgo: (days: number) => `hace ${days} días`,
    inMonth: (month: string) => `en ${month}`,
    any: "Cualquier Pokémon",
    noSource: "Sin fuente",
    series: (n: number | string) => `Serie ${n}`,
    theirs: (player: string, milestone: string) => `${milestone} de ${player}`,
    snapshots: (n: number) => `${n} capturas`,
    title: "Equipos",
    picked: (n: number) => (n === 1 ? "1 elegido" : `${n} elegidos`),
    cancel: "Cancelar",
    compareTeams: "Comparar equipos",
    compare: "Comparar",
    newTeam: "Equipo nuevo",
    startFrom: "Empezar desde",
    orStart: (reason: string) => `${reason}. O empieza desde:`,
    yours: "Tuyos",
    others: "Otros entrenadores",
    every: "Todos los equipos",
    empty: "Aún no hay equipos",
    noMatch: "Ningún equipo coincide con estos filtros",
    filters: "Filtros",
    filterTeams: "Filtrar equipos",
    seriesFilter: "Serie",
    kindFilter: "Tipo",
    stateFilter: "Estado",
    ownerFilter: "Dueño",
    allSeries: "Todas",
    allKinds: "Todos",
    allStates: "Todos",
    everyone: "Todos",
    you: (name: string) => `${name} (tú)`,
    kinds: { free: "Libre", round: "Ronda", cup: "Copa", try: "Intento de liga" } satisfies Record<TeamKind, string>,
    states: { todo: "Por montar", locked: "Bloqueado", edit: "Editable" } satisfies Record<TeamState, string>,
    leagueTry: (n: number) => `Intento de liga ${n}`,
    cupMatch: (stage: string, opponent: string) => `Copa · ${stage} contra ${opponent}`,
    roundMatch: (round: number, opponent: string | null) => (opponent ? `Ronda ${round} contra ${opponent}` : `Ronda ${round}`),
    waiting: (milestone: string) => `Llega a ${milestone} y sube su captura para tener tu equipo`,
    toSeries: "Súbela en la página de la serie",
    private: "Privado",
    privateTitle: "Solo tú y los administradores lo veis",
    shown: (n: number) => (n === 1 ? "1 equipo" : `${n} equipos`),
    clearFilters: "Quitar filtros",
    clear: "Quitar",
  },
});

const CompareDialog = lazy(() => import("@/teams/components/compare-view").then((m) => ({ default: m.CompareDialog })));

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

const DAY = 86_400_000;

function ago(iso: string, now = Date.now()): string {
  const at = new Date(iso);
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return t.today;
  if (days === 1) return t.yesterday;
  if (days < 7) return t.daysAgo(days);
  return t.inMonth(at.toLocaleString(locale, { month: "long" }));
}

function when(team: Pick<TeamRow, "league" | "lockedAt" | "updatedAt">): string {
  if (team.league?.kind === "try") return t.loggedOn(ago(team.league.at));
  if (team.lockedAt) return t.lockedOn(ago(team.lockedAt));
  return t.changedOn(ago(team.updatedAt));
}

export function sourceLine(team: Pick<TeamRow, "owner" | "series" | "sources" | "anyPokemon">, whole = false): string {
  const from =
    team.sources.length > 2 && !whole
      ? [t.snapshots(team.sources.length)]
      : team.sources.map((s) => (s.player.id === team.owner.id ? s.milestone : t.theirs(s.player.name, s.milestone)));
  if (team.anyPokemon) from.push(t.any);
  if (team.series.length === 0) return from.join(" + ") || t.noSource;
  const series = t.series(team.series.join(", "));
  return from.length ? `${series} · ${from.join(" + ")}` : series;
}

type Search = TeamsSearch;

function kept(team: TeamRow, search: Search): boolean {
  return (
    (search.series === undefined || team.series.includes(search.series)) &&
    (search.kind === undefined || teamKind(team) === search.kind) &&
    (search.state === undefined || team.state === search.state) &&
    (search.player === undefined || team.owner.id === search.player)
  );
}

function waitShown(wait: TeamWait, search: Search): boolean {
  return (search.series === undefined || search.series === wait.series) && (search.kind === undefined || search.kind === "round") && (search.state === undefined || search.state === "todo");
}

export function TeamsPage() {
  const { data } = authClient.useSession();
  const me = data?.user;
  const navigate = useNavigate();
  const search = useSearch({ from: "/teams" });
  const filter = search.player;
  const [list, setList] = useState<TeamRow[] | null>(null);
  const [named, setNamed] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState<string[] | null>(null);
  const [compareOpened, setCompareOpened] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [waits, setWaits] = useState<TeamWait[]>([]);
  const listed = list !== null && list.length > 0;
  const playing = me !== undefined && !me.admin;

  useEffect(() => {
    if (!playing) return;
    let live = true;
    api("/teams/waiting", teamWaits).then(
      (next) => live && setWaits(next),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [playing]);

  useEffect(() => {
    if (listed) teamPage.load();
  }, [listed]);

  useEffect(() => {
    let live = true;
    api("/teams", teamList).then(
      (next) => live && setList(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, []);

  const unlisted = filter !== undefined && list !== null && filter !== me?.id && !list.some((team) => team.owner.id === filter) ? filter : null;

  useEffect(() => {
    if (!unlisted) return;
    let live = true;
    api(`/profiles/${encodeURIComponent(unlisted)}`, profilePage).then(
      (page) => live && setNamed(page.player),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [unlisted]);

  async function newTeam(sources?: string[], anyPokemon?: boolean) {
    setMaking(true);
    setError(null);
    setStarting(null);
    try {
      const made = await api("/teams", teamMade, { body: sources ? { sources, anyPokemon } : {} });
      await navigate({ to: "/teams/$id", params: { id: made.id } });
    } catch (caught) {
      if (!sources && caught instanceof ApiError && caught.status === 400) setStarting(caught.message);
      else setError(message(caught));
      setMaking(false);
    }
  }

  const player = me && !me.admin ? me : null;
  const shown = (list ?? []).filter((team) => kept(team, search));
  const yours = player ? shown.filter((team) => team.owner.id === player.id) : [];
  const others = shown.filter((team) => team.owner.id !== player?.id);
  const filtered = Object.values(search).some((value) => value !== undefined);
  const active = Object.values(search).filter((value) => value !== undefined).length;
  const owners = new Map((list ?? []).map((team) => [team.owner.id, team.owner.name]));
  if (named && named.id === unlisted) owners.set(named.id, named.name);
  if (player) owners.delete(player.id);
  const ownerOptions = [
    { value: "", label: t.everyone },
    ...(player ? [{ value: player.id, label: t.you(player.name) }] : []),
    ...[...owners].sort(([, a], [, b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label })),
  ];
  const seriesNumbers = [...new Set([...(list ?? []).flatMap((team) => team.series), ...(search.series === undefined ? [] : [search.series])])].sort((a, b) => a - b);

  function refine(next: Search) {
    void navigate({ to: "/teams", search: (now) => ({ ...now, ...next }), replace: true });
  }
  const pick: Picking | null = picking
    ? {
        picked,
        full: picked.length >= MAX_COMPARED,
        onToggle: (id) => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : now.length < MAX_COMPARED ? [...now, id] : now)),
      }
    : null;

  function stopPicking() {
    setPicking(false);
    setPicked([]);
  }

  return (
    <main className={cn(toolPage, "gap-5 pt-5.5 pb-8 sm:gap-6 sm:pt-6")}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <h1 className="m-0 font-heading text-5xl leading-[0.85] font-normal sm:text-6xl">{t.title}</h1>
        <div className="flex-1" />
        {picking ? (
          <div className="flex items-center gap-3 max-sm:order-last max-sm:w-full">
            <span role="status" className="font-heading text-2xl text-primary max-sm:flex-1">
              {t.picked(picked.length)}
            </span>
            <button type="button" onClick={stopPicking} className={buttonVariants({ className: "min-h-12 px-4.5 text-2xl sm:min-h-13" })}>
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={picked.length < MIN_COMPARED}
              onClick={() => setComparing(picked)}
              className={buttonVariants({ variant: "go", className: "min-h-12 px-4 text-2xl sm:min-h-13 sm:px-5 sm:text-[1.625rem]" })}
            >
              {t.compareTeams}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPicked([]);
              setPicking(true);
              setCompareOpened(true);
            }}
            className={buttonVariants({ className: "min-h-12 px-4.5 text-2xl max-sm:order-last max-sm:w-full sm:min-h-13" })}
          >
            {t.compare}
          </button>
        )}
        {player && !picking && (
          <span className="relative flex">
            <button type="button" disabled={making} onClick={() => void newTeam()} className={buttonVariants({ variant: "go", className: "min-h-13 text-[1.625rem]" })}>
              <Plus className="size-5" aria-hidden="true" />
              {t.newTeam}
            </button>
            {starting !== null && (
              <SnapshotMenu
                label={t.startFrom}
                note={<p role="alert" className="m-0 px-2.5 pt-1 pb-1.5 text-sm text-muted-foreground">{t.orStart(starting)}</p>}
                className="top-full right-0 mt-2"
                onClose={() => setStarting(null)}
                onPick={(row) => void newTeam([row.id])}
                onAny={() => void newTeam([], true)}
              />
            )}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {list && (
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="team-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className={buttonVariants({ className: cn("min-h-12 gap-2 px-3.5 text-2xl sm:hidden", filtersOpen && "bg-border hover:bg-border") })}
          >
            <PixelIcon name="filter" className="size-3.5" />
            {t.filters}
            {active > 0 && <span className="min-w-6 rounded-full bg-primary px-1.5 text-center text-lg leading-6 text-primary-foreground">{active}</span>}
          </button>
          <div
            id="team-filters"
            role="group"
            aria-label={t.filterTeams}
            className={cn(
              "flex-col gap-3 rounded-[14px] border-3 bg-ink p-3 max-sm:order-last max-sm:w-full sm:flex sm:min-w-0 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0",
              filtersOpen ? "flex" : "hidden",
            )}
          >
            <FilterGroup
              id="team-filter-series"
              label={t.seriesFilter}
              options={[{ value: "", label: t.allSeries }, ...seriesNumbers.map((n) => ({ value: String(n), label: String(n) }))]}
              value={search.series === undefined ? "" : String(search.series)}
              onPick={(value) => refine({ series: value ? Number(value) : undefined })}
            />
            <FilterGroup
              id="team-filter-kind"
              label={t.kindFilter}
              options={[{ value: "", label: t.allKinds }, ...TEAM_KINDS.map((kind) => ({ value: kind, label: t.kinds[kind] }))]}
              value={search.kind ?? ""}
              onPick={(value) => refine({ kind: value === "" ? undefined : (value as TeamKind) })}
            />
            <FilterGroup
              id="team-filter-state"
              label={t.stateFilter}
              options={[{ value: "", label: t.allStates }, ...TEAM_STATES.map((state) => ({ value: state, label: t.states[state] }))]}
              value={search.state ?? ""}
              onPick={(value) => refine({ state: value === "" ? undefined : (value as TeamState) })}
            />
            <label className="flex flex-col gap-1.5 sm:min-h-13.5 sm:flex-row sm:items-center sm:gap-2.5 sm:rounded-xl sm:border-3 sm:bg-ink sm:pr-1.5 sm:pl-3.5">
              <span className="font-heading text-xl text-muted-foreground">{t.ownerFilter}</span>
              <select
                value={filter ?? ""}
                onChange={(event) => refine({ player: event.target.value || undefined })}
                className={cn(
                  "min-h-12 cursor-pointer rounded-lg border-2 bg-card px-2.5 font-heading text-[1.375rem] text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-10 sm:border-0",
                  filter ? "sm:bg-border" : "sm:bg-transparent",
                )}
              >
                {ownerOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span role="status" className="font-heading text-[1.375rem] text-muted-foreground max-sm:flex-1 sm:flex-none">
            {t.shown(shown.length)}
          </span>
          {filtered && (
            <button
              type="button"
              onClick={() => void navigate({ to: "/teams", search: {}, replace: true })}
              className={buttonVariants({ className: "min-h-12 px-3 text-[1.375rem] sm:min-h-11 sm:flex-none sm:px-3.5" })}
            >
              <span className="sm:hidden">{t.clear}</span>
              <span className="max-sm:hidden">{t.clearFilters}</span>
            </button>
          )}
        </div>
      )}
      {!list && !error && <TwoBlocks className="h-32 rounded-2xl" />}
      {list && (
        <div className="flex flex-col gap-3.5">
          {player && (!filter || filter === player.id) && (
            <Group
              id="teams-yours"
              title={t.yours}
              rows={yours}
              pick={pick}
              empty={filtered ? t.noMatch : t.empty}
              lead={waits.filter((wait) => waitShown(wait, search)).map((wait) => <Waiting key={wait.match} wait={wait} />)}
              mine
            />
          )}
          {(!filter || filter !== player?.id) && (
            <Group id="teams-others" title={player ? t.others : t.every} rows={others} pick={pick} empty={filtered ? t.noMatch : t.empty} showOwner />
          )}
        </div>
      )}
      {compareOpened && (
        <Suspense fallback={null}>
          <CompareDialog
            ids={comparing}
            onClose={() => {
              setComparing(null);
              stopPicking();
            }}
          />
        </Suspense>
      )}
    </main>
  );
}

function FilterGroup({
  id,
  label,
  options,
  value,
  onPick,
}: {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-1 sm:rounded-xl sm:border-3 sm:bg-ink sm:py-1 sm:pr-1 sm:pl-3.5">
      <span id={id} className="font-heading text-xl text-muted-foreground sm:mr-1.5">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:gap-0.5">
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(option.value)}
              className={cn(
                "min-h-11 cursor-pointer rounded-lg border-2 px-3.5 pb-0.5 font-heading text-[1.375rem] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-10 sm:border-0 sm:px-3",
                on ? "border-primary bg-border text-white" : "bg-card text-subtle hover:bg-cell hover:text-white sm:bg-transparent sm:text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Picking {
  picked: readonly string[];
  full: boolean;
  onToggle: (id: string) => void;
}

function Group({
  id,
  title,
  rows,
  pick,
  empty,
  showOwner = false,
  mine = false,
  lead = [],
}: {
  id: string;
  title: string;
  rows: TeamRow[];
  pick: Picking | null;
  empty: string;
  showOwner?: boolean;
  mine?: boolean;
  lead?: ReactNode[];
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="m-0 px-1 font-heading text-[1.75rem] leading-none font-normal text-subtle">
        {title}
      </h2>
      {lead}
      {rows.length === 0 && lead.length > 0 ? null : rows.length === 0 ? (
        <p className="m-0 flex min-h-23 items-center rounded-[14px] border-3 border-dashed px-6 font-heading text-[1.75rem] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((team) => (
            <li key={team.id}>
              <TeamLink team={team} showOwner={showOwner} mine={mine} pick={pick} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const rowClass =
  "flex min-h-23 w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-[14px] border-3 bg-card py-3 pr-6 pl-4 text-left text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-nowrap sm:py-0";

function TeamLink({ team, showOwner, mine, pick }: { team: TeamRow; showOwner: boolean; mine: boolean; pick: Picking | null }) {
  const filled = team.members.filter((m) => m !== null).length;
  if (!pick) {
    return (
      <Link to="/teams/$id" params={{ id: team.id }} className={cn(rowClass, "hover:border-primary")}>
        <RowBody team={team} showOwner={showOwner} mine={mine} filled={filled} />
      </Link>
    );
  }
  const on = pick.picked.includes(team.id);
  const off = !on && (pick.full || filled === 0);
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={off}
      onClick={() => pick.onToggle(team.id)}
      className={cn(rowClass, "font-[inherit]", on ? "border-primary bg-accent" : "cursor-pointer hover:border-primary", off && "cursor-default opacity-45 hover:border-border")}
    >
      <span
        aria-hidden="true"
        className={cn("grid size-8 flex-none place-items-center rounded-lg border-3 text-ink", on ? "border-primary bg-primary" : "border-cell-hi bg-ink")}
      >
        {on && <Check className="size-4.5" strokeWidth={3.5} />}
      </span>
      <RowBody team={team} showOwner={showOwner} mine={mine} filled={filled} />
    </button>
  );
}

function RowBody({ team, showOwner, mine, filled }: { team: TeamRow; showOwner: boolean; mine: boolean; filled: number }) {
  const size = team.members.length;
  const shown = mine && team.private && hasToggle(teamKind(team), team.lockedAt !== null);
  const marked = team.league !== null || team.state !== "edit" || shown;
  const owner = showOwner ? `${team.owner.name} · ` : "";
  return (
    <>
      <PlayerBadge name={team.owner.name} colour={playerColour(team.owner.name)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:w-75 sm:flex-none">
        <span className="truncate font-heading text-[2.125rem] leading-[0.9]">{team.name}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 sm:flex-col sm:flex-nowrap sm:items-start sm:gap-0.5">
          {marked && (
            <span className="contents sm:mt-0.5 sm:flex sm:items-center sm:gap-1.5">
              {team.league && <KindChip league={team.league} />}
              {team.state === "todo" && <Chip className="bg-round text-white">{t.states.todo}</Chip>}
              {team.state === "locked" && (
                <Chip className="border-2 border-cell-hi bg-ink text-subtle">
                  <PixelIcon name="lock" className="size-3" />
                  {t.states.locked}
                </Chip>
              )}
              {shown && (
                <Chip className="border-2 border-dashed border-cell-hi text-muted-foreground" title={t.privateTitle}>
                  <PixelIcon name="hidden" className="size-3" />
                  {t.private}
                </Chip>
              )}
            </span>
          )}
          <span
            title={owner + sourceLine(team, true)}
            className="text-[0.8125rem] leading-[1.3] font-bold text-muted-foreground sm:w-full sm:truncate sm:text-sm sm:leading-normal"
          >
            {owner}
            {sourceLine(team)}
          </span>
        </span>
      </span>
      <span className="flex flex-none flex-col items-end gap-0.5 sm:order-last">
        <span className={cn("font-heading text-[1.375rem]", filled === size ? "text-green" : "text-warning")}>
          {filled}/{size}
        </span>
        <span className="text-[0.8125rem] whitespace-nowrap text-muted-foreground">{when(team)}</span>
      </span>
      <span className="flex w-full min-w-0 gap-1 sm:w-auto sm:flex-1">
        {team.members.map((species, at) => {
          const sprite = species ? spriteOfName(species) : null;
          return (
            <span
              key={at}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[10px] border-2 sm:h-18 sm:max-w-20 sm:basis-20",
                size > 6 ? "h-10" : "h-12",
                species ? "border-solid bg-box" : "border-dashed",
              )}
            >
              {sprite && <img src={sprite} alt="" className="block size-full object-contain [image-rendering:pixelated]" />}
            </span>
          );
        })}
      </span>
    </>
  );
}

function Waiting({ wait }: { wait: TeamWait }) {
  return (
    <p className="m-0 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] border-3 border-dashed bg-box px-4 py-3 font-heading text-xl text-subtle sm:px-6">
      <KindChip league={{ kind: "round", series: wait.series, match: wait.match, round: wait.round, milestone: wait.milestone, opponent: wait.opponent }} />
      <span>{t.waiting(wait.milestone)}</span>
      <Link
        to="/series/$number"
        params={{ number: String(wait.series) }}
        className="text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t.toSeries}
      </Link>
    </p>
  );
}

function Chip({ className, title, children }: { className: string; title?: string; children: ReactNode }) {
  return (
    <span title={title} className={cn("flex h-5 flex-none items-center gap-1.25 rounded-[5px] px-2 font-heading text-base leading-none sm:h-5.5 sm:text-[1.0625rem]", className)}>
      {children}
    </span>
  );
}

const KIND_CHIP: { [K in TeamLeague["kind"]]: { className: string; icon: PixelIconName } } = {
  try: { className: "border-2 border-try-rim bg-try-fill text-try", icon: "league" },
  round: { className: "border-2 border-round-team-rim bg-round-team-fill text-round-team", icon: "flag" },
  cup: { className: "border-2 border-cup-rim bg-cup-fill text-cup", icon: "cup" },
};

function kindLabel(league: TeamLeague): string {
  if (league.kind === "try") return t.leagueTry(league.number);
  if (league.kind === "round") return t.roundMatch(league.round, league.opponent);
  return t.cupMatch(cupStage(league), league.opponent);
}

function KindChip({ league }: { league: TeamLeague }) {
  const chip = KIND_CHIP[league.kind];
  const label = kindLabel(league);
  return (
    <Chip className={chip.className}>
      <PixelIcon name={chip.icon} className="size-2.5 sm:size-2.75" />
      {label}
    </Chip>
  );
}
