import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { LeagueFrame } from "@/components/page-frames";
import { modeName, PairsCard, RoundAdmin, UnopenedCard } from "@/league/round-admin";
import { CupView, cupStatus } from "@/league/cup";
import { EggsCell, EggsEditor, EggsLine, EggsPen } from "@/league/eggs";
import { combatsLabel, Pips, Tries } from "@/league/tries";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";
import {
  type HatchedEggs,
  type LeagueMatch,
  type LeaguePage as League,
  type LeagueRound,
  leaguePage,
  type PairsInput,
  played,
  type RoundTeamState,
  type Standing,
  winnerOf,
} from "../../shared/league";

const t = messages({
  en: {
    failed: "Something went wrong",
    breadcrumb: "Breadcrumb",
    series: (n: number) => `Series ${n}`,
    title: "League",
    view: "View",
    overview: "Overview",
    rounds: "Rounds",
    tries: "Pokémon League",
    cup: "Cup",
    status: (open: number, all: number, done: number, total: number) => `${open} of ${all} rounds · ${done} of ${total} played`,
    standings: "Standings",
    place: "#",
    trainer: "Trainer",
    points: "Points",
    pts: (n: number) => (n === 1 ? "pt" : "pts"),
    wl: "W–L",
    games: "Games",
    fainted: "Fainted",
    pokemonLeague: "Pokémon League",
    eggs: "Eggs",
    you: "You",
    beat: (names: string) => `Beat ${names}`,
    lostTo: (names: string) => `Lost to ${names}`,
    drawn: "Random draw",
    youInLeague: "You in the league",
    next: "Your next match",
    yourRounds: "Your rounds",
    now: "Now in the league",
    latest: "Latest results",
    noResults: "No results yet",
    round: (n: number) => `Round ${n}`,
    short: (n: number) => `R${n}`,
    stage: (n: number, milestone: string) => `Round ${n} · ${milestone}`,
    vs: (name: string) => `vs ${name}`,
    allPlayed: "All played",
    toPlay: (n: number) => `${n} to play`,
    bye: (name: string) => `${name} rests`,
    lockToSee: "Lock your round team to see who you meet",
    waiting: (milestone: string) => `Reach ${milestone} and upload its snapshot to get your team`,
    lockToSeeAll: "Lock your round team to see this round's pairs",
    hiddenPairs: (n: number) => (n === 1 ? "1 pair shows once both its players lock" : `${n} pairs show once both their players lock`),
    won: "W",
    lost: "L",
    matchLabel: (a: string, b: string, score: string | null) => `${a} vs ${b}, ${score ?? "to play"}`,
    roundLabel: (a: string, b: string, n: number, score: string | null) => `${a} vs ${b}, round ${n}, ${score ?? "to play"}`,
    headToHead: "Head to head",
    noRounds: "No round has been opened yet",
    roundTeams: "Round teams",
    teamStates: { locked: "Locked", building: "Building", save: "Needs the save" } satisfies Record<RoundTeamState, string>,
    teamsLabel: (a: string, stateA: string, b: string, stateB: string) => `${a}: ${stateA}, ${b}: ${stateB}`,
  },
  es: {
    failed: "Algo ha fallado",
    breadcrumb: "Ruta de navegación",
    series: (n: number) => `Serie ${n}`,
    title: "Liga",
    view: "Vista",
    overview: "Resumen",
    rounds: "Rondas",
    tries: "Liga Pokémon",
    cup: "Copa",
    status: (open: number, all: number, done: number, total: number) => `${open} de ${all} rondas · ${done} de ${total} jugados`,
    standings: "Clasificación",
    place: "#",
    trainer: "Entrenador",
    points: "Puntos",
    pts: (n: number) => (n === 1 ? "pt" : "pts"),
    wl: "V–D",
    games: "Partidas",
    fainted: "Debilitados",
    pokemonLeague: "Liga Pokémon",
    eggs: "Huevos",
    you: "Tú",
    beat: (names: string) => `Ganó a ${names}`,
    lostTo: (names: string) => `Perdió con ${names}`,
    drawn: "Sorteo",
    youInLeague: "Tú en la liga",
    next: "Tu próximo combate",
    yourRounds: "Tus rondas",
    now: "Ahora en la liga",
    latest: "Últimos resultados",
    noResults: "Aún no hay resultados",
    round: (n: number) => `Ronda ${n}`,
    short: (n: number) => `R${n}`,
    stage: (n: number, milestone: string) => `Ronda ${n} · ${milestone}`,
    vs: (name: string) => `contra ${name}`,
    allPlayed: "Todo jugado",
    toPlay: (n: number) => `${n} por jugar`,
    bye: (name: string) => `${name} descansa`,
    lockToSee: "Bloquea tu equipo de ronda para ver contra quién juegas",
    waiting: (milestone: string) => `Llega a ${milestone} y sube su captura para tener tu equipo`,
    lockToSeeAll: "Bloquea tu equipo de ronda para ver las parejas de esta ronda",
    hiddenPairs: (n: number) => (n === 1 ? "1 pareja se ve cuando sus dos jugadores bloqueen" : `${n} parejas se ven cuando sus dos jugadores bloqueen`),
    won: "V",
    lost: "D",
    matchLabel: (a: string, b: string, score: string | null) => `${a} contra ${b}, ${score ?? "por jugar"}`,
    roundLabel: (a: string, b: string, n: number, score: string | null) => `${a} contra ${b}, ronda ${n}, ${score ?? "por jugar"}`,
    headToHead: "Cara a cara",
    noRounds: "Aún no se ha abierto ninguna ronda",
    roundTeams: "Equipos de ronda",
    teamStates: { locked: "Bloqueado", building: "Montando", save: "Falta la captura" } satisfies Record<RoundTeamState, string>,
    teamsLabel: (a: string, stateA: string, b: string, stateB: string) => `${a}: ${stateA}, ${b}: ${stateB}`,
  },
});

const FROM = "/series/$number/league";

export type LeagueView = "overview" | "rounds" | "tries" | "cup";

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

function score(match: LeagueMatch, side: "a" | "b" = "a"): string | null {
  if (!played(match)) return null;
  return side === "a" ? `${match.gamesA}–${match.gamesB}` : `${match.gamesB}–${match.gamesA}`;
}

export function LeaguePage() {
  const { number } = useParams({ from: FROM });
  const { view = "overview" } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLeague(null);
    setError(null);
    api(`/series/${encodeURIComponent(number)}/league`, leaguePage).then(setLeague, (caught: unknown) => setError(message(caught)));
  }, [number]);

  if (error) {
    return (
      <main className={cn(listPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!league) return <LeagueFrame />;

  const names = new Map(league.players.map((p) => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? "?";
  const me = session?.user.id && names.has(session.user.id) ? session.user.id : null;
  const matches = league.rounds.flatMap((r) => r.matches);
  const views: { value: LeagueView; label: string }[] = [
    { value: "overview", label: t.overview },
    { value: "rounds", label: t.rounds },
    { value: "tries", label: t.tries },
    { value: "cup", label: t.cup },
  ];

  return (
    <main className={cn(listPage, "gap-4 pt-4 pb-8 sm:gap-5.5 sm:pt-5.5 sm:pb-10")}>
      <div className="flex flex-col gap-2.5 sm:gap-3.5">
        <nav aria-label={t.breadcrumb} className="flex font-heading text-xl sm:text-[1.375rem]">
          <Link
            to="/series/$number"
            params={{ number: String(league.number) }}
            className="-my-2.5 flex min-h-11 items-center gap-2 text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <svg viewBox="0 0 14 18" aria-hidden="true" className="h-3 w-2 fill-current">
              <path d="M12 2L2 9l10 7z" />
            </svg>
            {t.series(league.number)}
          </Link>
        </nav>
        <div className="flex flex-wrap items-end gap-3 sm:gap-6">
          <h1 className="m-0 font-heading text-[3.25rem] leading-[0.85] font-normal sm:text-6xl">{t.title}</h1>
          <span className="ml-auto flex min-h-9 items-center rounded-lg border-3 bg-ink px-2.5 font-heading text-lg whitespace-nowrap text-subtle sm:order-last sm:min-h-11 sm:rounded-[10px] sm:px-3.5 sm:text-[1.375rem]">
            {view === "cup" && league.cup ? cupStatus(league.cup) : t.status(league.rounds.length, league.roundMilestones.length, matches.filter(played).length + hiddenPlayed(league), matches.length + hiddenPairs(league))}
          </span>
          <div role="radiogroup" aria-label={t.view} className="grid w-full grid-cols-2 gap-1 rounded-xl border-3 bg-ink p-1 sm:flex sm:w-auto">
            {views.map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={v.value === view}
                onClick={() => void navigate({ to: FROM, params: { number }, search: v.value === "overview" ? {} : { view: v.value }, replace: true })}
                className={cn(
                  "min-h-11 cursor-pointer rounded-lg px-2 pb-0.5 font-heading text-[1.375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-4.5 sm:text-2xl",
                  v.value === view ? "bg-border text-white" : "text-muted-foreground hover:bg-cell hover:text-white",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === "rounds" ? (
        <Rounds league={league} me={me} nameOf={nameOf} onChange={setLeague} />
      ) : view === "tries" ? (
        <Tries league={league} me={me} nameOf={nameOf} onChange={setLeague} />
      ) : view === "cup" ? (
        <CupView league={league} nameOf={nameOf} onChange={setLeague} />
      ) : (
        <Overview league={league} me={me} nameOf={nameOf} onChange={setLeague} />
      )}
    </main>
  );
}

type Named = { league: League; me: string | null; nameOf: (id: string) => string };

function Overview({ league, me, nameOf, onChange }: Named & { onChange: (league: League) => void }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-5">
      <StandingsTable league={league} me={me} nameOf={nameOf} onChange={onChange} />
      {me ? <Mine league={league} me={me} nameOf={nameOf} /> : <Latest league={league} nameOf={nameOf} />}
    </div>
  );
}

function tieNote(row: Standing, nameOf: (id: string) => string): string | null {
  if (!row.tie) return null;
  if (row.tie.beat.length) return t.beat(row.tie.beat.map(nameOf).join(", "));
  if (row.tie.lostTo.length) return t.lostTo(row.tie.lostTo.map(nameOf).join(", "));
  return t.drawn;
}

const STANDING_COLUMNS = "grid-cols-[30px_minmax(0,1fr)_56px] sm:grid-cols-[56px_minmax(0,1fr)_84px_72px_84px_84px_124px_88px]";

const ADMIN_COLUMNS = "grid-cols-[30px_minmax(0,1fr)_40px_44px] sm:grid-cols-[56px_minmax(0,1fr)_84px_72px_84px_84px_124px_120px]";

function StandingsTable({ league, me, nameOf, onChange }: Named & { onChange: (league: League) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const columns = league.admin ? ADMIN_COLUMNS : STANDING_COLUMNS;
  const eggsOf = (player: string): HatchedEggs => league.hatched.find((h) => h.player === player) ?? { player, count: 0, saved: null, set: null };
  return (
    <div role="table" aria-label={t.standings} className="overflow-hidden rounded-[18px] border-3 bg-card">
      <div role="rowgroup" className="hidden sm:block">
        <div role="row" className={cn("grid min-h-12 items-center border-b-3 bg-box font-heading text-xl text-muted-foreground", columns)}>
          <span role="columnheader" className="text-center">
            {t.place}
          </span>
          <span role="columnheader">{t.trainer}</span>
          <span role="columnheader" className="text-center text-yellow">
            {t.points}
          </span>
          <span role="columnheader" className="text-center">
            {t.wl}
          </span>
          <span role="columnheader" className="text-center">
            {t.games}
          </span>
          <span role="columnheader" className="text-center">
            {t.fainted}
          </span>
          <span role="columnheader" className="text-center">
            {t.pokemonLeague}
          </span>
          <span role="columnheader" className="text-center">
            {t.eggs}
          </span>
        </div>
      </div>
      <div role="rowgroup">
        {league.standings.map((row, index) => {
          const name = nameOf(row.player);
          const note = tieNote(row, nameOf);
          const first = row.place === 1;
          const eggs = eggsOf(row.player);
          const open = league.admin && editing === row.player;
          const toggle = () => setEditing(open ? null : row.player);
          return (
            <div key={row.player} className={cn(row.player === me && "bg-yellow/6", index < league.standings.length - 1 && "border-b-3")}>
              <div
                role="row"
                className={cn("grid min-h-17 items-center gap-2.5 py-1.5 pr-3 pl-2 text-foreground hover:bg-row-hi sm:min-h-19 sm:gap-0 sm:p-0", columns)}
              >
                <span role="cell" className={cn("text-center font-heading text-[1.875rem] sm:text-4xl", first ? "text-yellow" : "text-faint")}>
                  {row.place}
                </span>
                <span role="cell" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <PlayerBadge name={name} colour={playerColour(name)} size="sm" />
                  <span className="flex min-w-0 flex-col gap-0.5 leading-[1.05]">
                    <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <Link
                        to="/players/$player"
                        params={{ player: row.player }}
                        className="truncate rounded-sm font-heading text-[1.5625rem] text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-[1.75rem]"
                      >
                        {name}
                      </Link>
                      {row.player === me && <span className="rounded-sm bg-yellow px-1.5 font-heading text-sm text-ink sm:text-[0.9375rem]">{t.you}</span>}
                    </span>
                    <span className="flex items-center gap-2 sm:hidden">
                      <Pips won={row.best ?? 0} size="sm" />
                      <span className="sr-only">{combatsLabel(row.best)}</span>
                      <span className="font-heading text-[1.0625rem] whitespace-nowrap text-muted-foreground">
                        {row.wins}–{row.losses} · {row.gamesWon}–{row.gamesLost}
                      </span>
                    </span>
                    <span className="sm:hidden">
                      <EggsLine won={row.eggsWon} eggs={eggs} />
                    </span>
                    {note && <span className="text-xs font-bold text-muted-foreground sm:text-[0.8125rem]">{note}</span>}
                  </span>
                </span>
                <span role="cell" className="flex flex-col items-end leading-[0.95] sm:items-center">
                  <span className={cn("font-heading text-4xl sm:text-[2.5rem]", first ? "text-yellow" : "text-foreground")}>{row.points}</span>
                  <span className="font-heading text-sm text-muted-foreground sm:hidden">{t.pts(row.points)}</span>
                </span>
                <span role="cell" className="hidden text-center font-heading text-[1.625rem] sm:block">
                  {row.wins}–{row.losses}
                </span>
                <span role="cell" className="hidden text-center font-heading text-2xl text-muted-foreground sm:block">
                  {row.gamesWon}–{row.gamesLost}
                </span>
                <span role="cell" className="hidden text-center font-heading text-2xl text-muted-foreground sm:block">
                  {row.fainted}
                </span>
                <span role="cell" className="hidden justify-center sm:flex">
                  <Pips won={row.best ?? 0} size="md" />
                  <span className="sr-only">{combatsLabel(row.best)}</span>
                </span>
                <span role="cell" className="hidden items-center justify-center gap-1.5 sm:flex">
                  <EggsCell won={row.eggsWon} eggs={eggs} />
                  {league.admin && <EggsPen name={name} open={open} onClick={toggle} size="sm" />}
                </span>
                {league.admin && (
                  <span role="cell" className="sm:hidden">
                    <EggsPen name={name} open={open} onClick={toggle} size="lg" />
                  </span>
                )}
              </div>
              {open && (
                <EggsEditor
                  key={`${row.player}:${eggs.count}:${eggs.set?.at ?? ""}`}
                  number={league.number}
                  player={row.player}
                  name={name}
                  won={row.eggsWon}
                  eggs={eggs}
                  onDone={onChange}
                  onClose={() => setEditing(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function hiddenPairs(league: League): number {
  return league.rounds.reduce((sum, round) => sum + (round.hidden?.pairs ?? 0), 0);
}

function hiddenPlayed(league: League): number {
  return league.rounds.reduce((sum, round) => sum + (round.hidden ? round.hidden.pairs - round.hidden.toPlay : 0), 0);
}

function Mine({ league, me, nameOf }: Named & { me: string }) {
  const mine = league.rounds.flatMap((round) => round.matches.filter((m) => m.a === me || m.b === me).map((match) => ({ round, match })));
  const next = mine.find(({ match }) => !played(match));
  const held = league.rounds.find((round) => round.hidden?.yours);
  return (
    <aside aria-label={t.youInLeague} className="flex flex-col gap-3.5">
      {next ? (
        <NextMatch number={league.number} round={next.round} match={next.match} me={me} nameOf={nameOf} />
      ) : (
        held && <HeldBack number={league.number} round={held} />
      )}
      <section aria-labelledby="yours" className="flex flex-col gap-2 rounded-[18px] border-3 bg-card px-3.5 pt-3.5 pb-4 sm:px-4.5 sm:pt-4 sm:pb-4.5">
        <h2 id="yours" className="m-0 mb-1 font-heading text-[1.625rem] font-normal">
          {t.yourRounds}
        </h2>
        {mine.map(({ round, match }) => {
          const home = match.a === me;
          const done = played(match);
          const won = winnerOf(match) === me;
          return (
            <Link
              key={match.id}
              to={MATCH}
              params={{ number: String(league.number), id: match.id }}
              className={cn(
                "grid min-h-11.5 grid-cols-[34px_26px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] border-3 bg-box px-3 text-foreground sm:grid-cols-[44px_30px_minmax(0,1fr)_auto]",
                matchRow,
              )}
            >
              <span className="font-heading text-lg text-muted-foreground">{t.short(round.number)}</span>
              <span
                className={cn(
                  "grid size-6.5 place-items-center rounded-md font-heading text-lg text-ink",
                  !done ? "bg-cell-hi" : won ? "bg-green" : "bg-coral",
                )}
              >
                {!done ? "·" : won ? t.won : t.lost}
              </span>
              <span className="truncate font-heading text-[1.375rem] sm:text-[1.4375rem]">{t.vs(nameOf(home ? match.b : match.a))}</span>
              <span className={cn("font-heading text-[1.4375rem] sm:text-2xl", won ? "text-yellow" : "text-foreground")}>
                {score(match, home ? "a" : "b") ?? ""}
              </span>
            </Link>
          );
        })}
      </section>
    </aside>
  );
}

function NextMatch({ number, round, match, me, nameOf }: { number: number; round: LeagueRound; match: LeagueMatch; me: string; nameOf: (id: string) => string }) {
  const other = nameOf(match.a === me ? match.b : match.a);
  return (
    <Link
      to={MATCH}
      params={{ number: String(number), id: match.id }}
      aria-labelledby="next"
      aria-describedby="next-match"
      className={cn("flex flex-col gap-3 rounded-[18px] border-3 border-primary bg-card px-3.5 pt-3.5 pb-4 text-foreground sm:px-4.5 sm:pt-4 sm:pb-4.5", matchRow)}
    >
      <span id="next" className="font-heading text-xl text-primary">
        {t.next}
      </span>
      <span className="flex items-center gap-3">
        <PlayerBadge name={other} colour={playerColour(other)} size="sm" />
        <span id="next-match" className="flex min-w-0 flex-1 flex-col leading-[1.1]">
          <span className="truncate font-heading text-[1.75rem] sm:text-3xl">{t.vs(other)}</span>
          <span className="text-[0.8125rem] font-bold text-muted-foreground sm:text-sm">{t.stage(round.number, round.milestone)}</span>
        </span>
      </span>
    </Link>
  );
}

function HeldBack({ number, round }: { number: number; round: LeagueRound }) {
  const upload = round.hidden?.yours === "upload";
  return (
    <Link
      to={upload ? "/series/$number" : "/teams"}
      params={upload ? { number: String(number) } : undefined}
      aria-labelledby="next"
      aria-describedby="next-match"
      className={cn("flex flex-col gap-3 rounded-[18px] border-3 border-primary bg-card px-3.5 pt-3.5 pb-4 text-foreground sm:px-4.5 sm:pt-4 sm:pb-4.5", matchRow)}
    >
      <span id="next" className="font-heading text-xl text-primary">
        {t.next}
      </span>
      <span id="next-match" className="flex min-w-0 flex-col leading-[1.1]">
        <span className="font-heading text-[1.75rem] sm:text-3xl">{upload ? t.waiting(round.milestone) : t.lockToSee}</span>
        <span className="text-[0.8125rem] font-bold text-muted-foreground sm:text-sm">{t.stage(round.number, round.milestone)}</span>
      </span>
    </Link>
  );
}

function Latest({ league, nameOf }: { league: League; nameOf: (id: string) => string }) {
  const results = league.rounds
    .flatMap((round) => round.matches.filter(played).map((match) => ({ round, match })))
    .reverse()
    .slice(0, 5);
  return (
    <aside aria-label={t.now} className="flex flex-col gap-3.5">
      <section aria-labelledby="latest" className="flex flex-col gap-2 rounded-[18px] border-3 bg-card px-3.5 pt-3.5 pb-4 sm:px-4.5 sm:pt-4 sm:pb-4.5">
        <h2 id="latest" className="m-0 mb-1 font-heading text-[1.625rem] font-normal">
          {t.latest}
        </h2>
        {results.length === 0 && <p className="m-0 font-heading text-xl text-faint">{t.noResults}</p>}
        {results.map(({ round, match }) => {
          const winner = winnerOf(match);
          return (
            <Link
              key={match.id}
              to={MATCH}
              params={{ number: String(league.number), id: match.id }}
              className={cn(
                "grid min-h-11.5 grid-cols-[44px_minmax(0,1fr)_56px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border-3 bg-box px-3 font-heading text-foreground sm:grid-cols-[64px_minmax(0,1fr)_56px_minmax(0,1fr)]",
                matchRow,
              )}
            >
              <span className="text-[1.0625rem] text-muted-foreground">{t.short(round.number)}</span>
              <span className={cn("truncate text-[1.375rem]", winner === match.a ? "text-yellow" : "text-muted-foreground")}>{nameOf(match.a)}</span>
              <span className="text-center text-[1.375rem]">{score(match)}</span>
              <span className={cn("truncate text-right text-[1.375rem]", winner === match.b ? "text-yellow" : "text-muted-foreground")}>{nameOf(match.b)}</span>
            </Link>
          );
        })}
      </section>
    </aside>
  );
}

function Rounds({ league, me, nameOf, onChange }: Named & { onChange: (league: League) => void }) {
  const [draft, setDraft] = useState<PairsInput | null>(null);
  const last = league.rounds.at(-1)?.number;
  const unopened = league.admin
    ? league.roundMilestones.map((milestone, index) => ({ number: index + 1, milestone })).filter((m) => !league.rounds.some((r) => r.number === m.number))
    : [];
  return (
    <>
      {league.admin && <RoundAdmin league={league} draft={draft} onDraft={setDraft} onChange={onChange} />}
      {league.rounds.length === 0 && (
        <p className={cn("m-0 rounded-[18px] border-3 border-dashed bg-box px-5 py-8 text-center font-heading text-2xl text-faint", league.admin && "sm:hidden")}>{t.noRounds}</p>
      )}
      {(league.rounds.length > 0 || league.admin) && (
        <div className="flex flex-col-reverse gap-3.5 sm:grid sm:grid-cols-2 lg:grid-cols-5 2xl:grid-cols-3">
          {league.rounds.map((round) =>
            draft && round.number === last ? (
              <PairsCard key={round.number} league={league} round={round} draft={draft} onDraft={setDraft} nameOf={nameOf} />
            ) : (
              <RoundCard key={round.number} number={league.number} round={round} current={round.number === last} me={me} nameOf={nameOf} />
            ),
          )}
          {unopened.map((m) => (
            <UnopenedCard key={m.number} number={m.number} milestone={m.milestone} matches={Math.floor(league.players.length / 2)} />
          ))}
        </div>
      )}
      {league.rounds.at(-1)?.matches.some((m) => !played(m)) && !draft && <TeamStatesKey />}
      {league.rounds.length > 0 && <HeadToHead league={league} me={me} nameOf={nameOf} />}
    </>
  );
}

function RoundCard({ number, round, current, me, nameOf }: { number: number; round: LeagueRound; current: boolean; me: string | null; nameOf: (id: string) => string }) {
  const left = round.matches.filter((m) => !played(m)).length + (round.hidden?.toPlay ?? 0);
  return (
    <section
      aria-label={t.round(round.number)}
      className={cn("flex flex-col gap-2 rounded-[18px] border-3 bg-card px-3 pt-3 pb-3.5 sm:gap-2.5 sm:px-3.5 sm:pt-3.5 sm:pb-4", current && "border-primary")}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 px-0.5 sm:flex-col sm:gap-0.5">
        <span className="flex items-baseline gap-2.5">
          <h2 className="m-0 font-heading text-[1.75rem] font-normal sm:text-3xl">{t.round(round.number)}</h2>
          <span className="font-heading text-[1.1875rem] text-muted-foreground sm:text-xl">{round.milestone}</span>
          {round.mode === "closed" && <span className="rounded-sm bg-cell px-1.5 font-heading text-[0.9375rem] text-subtle">{modeName(round.mode)}</span>}
        </span>
        <span className="flex-1 sm:hidden" />
        <span className={cn("font-heading text-[1.1875rem] sm:text-xl", left ? "text-warning" : "text-green")}>{left ? t.toPlay(left) : t.allPlayed}</span>
      </div>
      {round.matches.map((match) => (
        <MatchBox key={match.id} number={number} match={match} mine={match.a === me || match.b === me} states={current && !played(match)} nameOf={nameOf} />
      ))}
      {round.hidden && (
        <p className="m-0 rounded-xl border-3 border-dashed bg-box px-3 py-2.5 font-heading text-lg text-subtle">
          {round.hidden.yours === "upload" ? t.waiting(round.milestone) : round.hidden.yours === "lock" ? t.lockToSeeAll : t.hiddenPairs(round.hidden.pairs)}
        </p>
      )}
      {round.bye && <span className="px-0.5 font-heading text-lg text-muted-foreground">{t.bye(nameOf(round.bye))}</span>}
    </section>
  );
}

const MATCH = "/series/$number/league/matches/$id";

const matchRow = "outline-none hover:border-primary hover:bg-row-hi focus-visible:ring-3 focus-visible:ring-ring/50";

const TEAM_TONE: Record<RoundTeamState, string> = { locked: "text-green", building: "text-warning", save: "text-faint" };

function TeamStatesKey() {
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-5.5 gap-y-1 rounded-[14px] border-3 bg-box px-5 py-3.5 font-heading text-xl text-subtle">
      <span className="text-muted-foreground">{t.roundTeams}</span>
      {(Object.keys(TEAM_TONE) as RoundTeamState[]).map((state) => (
        <span key={state} className={TEAM_TONE[state]}>
          {t.teamStates[state]}
        </span>
      ))}
    </p>
  );
}

function TeamState({ state, className }: { state: RoundTeamState; className?: string }) {
  return <span className={cn("font-heading text-[1.0625rem] whitespace-nowrap", TEAM_TONE[state], className)}>{t.teamStates[state]}</span>;
}

function MatchBox({ number, match, mine, states, nameOf }: { number: number; match: LeagueMatch; mine: boolean; states: boolean; nameOf: (id: string) => string }) {
  const done = played(match);
  const winner = winnerOf(match);
  const sides = [
    { id: match.a, games: match.gamesA, team: match.teamA },
    { id: match.b, games: match.gamesB, team: match.teamB },
  ];
  const label = t.matchLabel(nameOf(match.a), nameOf(match.b), score(match));
  const border = cn("rounded-xl border-3 bg-box group-hover:border-primary group-hover:bg-row-hi", done ? "border-solid" : "border-dashed", mine ? "border-trophy-rim" : "border-border");
  return (
    <Link
      to={MATCH}
      params={{ number: String(number), id: match.id }}
      aria-label={states ? `${label}; ${t.teamsLabel(nameOf(match.a), t.teamStates[match.teamA], nameOf(match.b), t.teamStates[match.teamB])}` : label}
      className="group rounded-xl text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div aria-hidden="true" className={cn(border, "grid min-h-12 grid-cols-[minmax(0,1fr)_54px_minmax(0,1fr)] items-center gap-1.5 px-2.5 sm:hidden", states && "py-1.5")}>
        {sides.map((side, index) => {
          const name = nameOf(side.id);
          return (
            <span
              key={side.id}
              className={cn("flex min-w-0 items-center gap-2", index === 1 && "order-last flex-row-reverse", winner && winner !== side.id && "opacity-55")}
            >
              <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
              <span className={cn("flex min-w-0 flex-col", index === 1 && "items-end")}>
                <span className={cn("truncate font-heading text-[1.375rem]", winner === side.id ? "text-yellow" : "text-foreground")}>{name}</span>
                {states && <TeamState state={side.team} className="-mt-1 leading-none" />}
              </span>
            </span>
          );
        })}
        <span className={cn("text-center font-heading text-2xl", done ? "text-foreground" : "text-faint")}>{score(match) ?? "–"}</span>
      </div>
      <div aria-hidden="true" className={cn(border, "hidden flex-col overflow-hidden sm:flex")}>
        {sides.map((side, index) => {
          const name = nameOf(side.id);
          return (
            <span
              key={side.id}
              className={cn("flex min-h-10 items-center gap-2.5 px-3", index === 1 && "border-t-2 border-cell", winner && winner !== side.id && "opacity-55")}
            >
              <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
              <span className={cn("min-w-0 flex-1 truncate font-heading text-[1.4375rem]", winner === side.id ? "text-yellow" : "text-foreground")}>{name}</span>
              {states ? (
                <TeamState state={side.team} />
              ) : (
                <span className={cn("font-heading text-[1.625rem]", winner === side.id ? "text-yellow" : "text-foreground")}>{side.games ?? ""}</span>
              )}
            </span>
          );
        })}
      </div>
    </Link>
  );
}

function HeadToHead({ league, me, nameOf }: Named) {
  const order = league.standings.map((row) => row.player);
  const meet = (x: string, y: string) => {
    for (const round of league.rounds) {
      for (const match of round.matches) {
        if (match.a === x && match.b === y) return { round: round.number, match, side: "a" as const };
        if (match.a === y && match.b === x) return { round: round.number, match, side: "b" as const };
      }
    }
    return null;
  };
  const columns = { gridTemplateColumns: `var(--h2h-head) repeat(${order.length}, minmax(0, 1fr)) var(--h2h-tail)` };
  return (
    <section aria-labelledby="h2h" className="flex flex-col gap-2.5">
      <h2 id="h2h" className="m-0 px-1 font-heading text-3xl font-normal">
        {t.headToHead}
      </h2>
      <div
        role="table"
        aria-label={t.headToHead}
        className="overflow-hidden rounded-[18px] border-3 bg-card [--h2h-head:44px] [--h2h-tail:0px] sm:[--h2h-head:220px] sm:[--h2h-tail:110px]"
      >
        <div role="row" className="grid min-h-10 items-center border-b-3 bg-box sm:min-h-13" style={columns}>
          <span role="columnheader" className="font-heading text-[1.3125rem] text-muted-foreground sm:px-5">
            <span className="sr-only sm:not-sr-only">{t.trainer}</span>
          </span>
          {order.map((id) => {
            const name = nameOf(id);
            return (
              <span key={id} role="columnheader" aria-label={name} className="flex items-center justify-center gap-2 font-heading text-[1.3125rem] text-subtle">
                <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
                <span aria-hidden="true" className="hidden truncate lg:inline">
                  {name}
                </span>
              </span>
            );
          })}
          <span role="columnheader" className="hidden text-center font-heading text-[1.3125rem] text-muted-foreground sm:block">
            {t.wl}
          </span>
        </div>
        {league.standings.map((row, index) => {
          const name = nameOf(row.player);
          return (
            <div
              key={row.player}
              role="row"
              className={cn("grid min-h-12.5 items-stretch sm:min-h-17", row.player === me && "bg-yellow/6", index < order.length - 1 && "border-b-3")}
              style={columns}
            >
              <span role="rowheader" aria-label={name} className="flex items-center justify-center gap-3 sm:justify-start sm:px-5">
                <PlayerBadge name={name} colour={playerColour(name)} size="cell" />
                <span aria-hidden="true" className="hidden truncate font-heading text-[1.625rem] sm:inline">
                  {name}
                </span>
                {row.player === me && <span className="hidden rounded-sm bg-yellow px-1.75 font-heading text-base text-ink sm:inline">{t.you}</span>}
              </span>
              {order.map((other) => {
                if (other === row.player) {
                  return (
                    <span key={other} role="cell" className="flex p-0.75 sm:p-1.5">
                      <span aria-hidden="true" className="flex-1 rounded-[7px] bg-[repeating-linear-gradient(135deg,var(--ink)_0_6px,var(--box)_6px_12px)] sm:rounded-[10px]" />
                    </span>
                  );
                }
                const met = meet(row.player, other);
                if (!met) {
                  return (
                    <span key={other} role="cell" className="grid place-items-center font-heading text-lg text-cell-hi sm:text-[1.375rem]">
                      —
                    </span>
                  );
                }
                const done = played(met.match);
                const won = winnerOf(met.match) === row.player;
                const result = score(met.match, met.side);
                return (
                  <span key={other} role="cell" className="flex p-0.75 sm:p-1.5">
                    <Link
                      to={MATCH}
                      params={{ number: String(league.number), id: met.match.id }}
                      aria-label={t.roundLabel(name, nameOf(other), met.round, result)}
                      className={cn(
                        "flex flex-1 flex-col items-center justify-center rounded-[7px] border-2 leading-none outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:gap-2.5 sm:rounded-[10px] sm:border-3",
                        !done ? "border-dashed border-warning/40" : won ? "border-mult-2 bg-green/10" : "border-coral/35 bg-coral/8",
                      )}
                    >
                      <span className={cn("font-heading text-[1.1875rem] sm:text-[1.75rem]", !done ? "text-warning" : won ? "text-green" : "text-coral")}>{result ?? ""}</span>
                      <span className="font-heading text-[0.8125rem] text-muted-foreground sm:text-[1.0625rem]">{t.short(met.round)}</span>
                    </Link>
                  </span>
                );
              })}
              <span role="cell" className="hidden place-items-center font-heading text-[1.625rem] text-subtle sm:grid">
                {row.wins}–{row.losses}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
