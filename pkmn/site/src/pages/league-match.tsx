import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { MatchFrame } from "@/components/page-frames";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { stageName } from "@/league/cup";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";
import { PixelIcon } from "@/components/pixel-icon";
import { TypeTag } from "@/components/pc/summary";
import { dexName } from "../../shared/dex-text";
import { FAINTED_PER_GAME, type GameInput, MATCH_GAMES, type MatchMember, type MatchPage, matchPage, type MatchTeam, POINTS_PER_WIN, tally } from "../../shared/league";

const t = messages({
  en: {
    failed: "Something went wrong",
    breadcrumb: "Breadcrumb",
    series: (n: number) => `Series ${n}`,
    league: "League",
    round: (n: number) => `Round ${n}`,
    stage: (n: number) => `Round ${n} · Bo3`,
    cup: (stage: string) => `Cup · ${stage}`,
    cupStage: (stage: string) => `${stage} · Bo3`,
    seed: (n: number) => `Seed ${n}`,
    onward: (stage: string, name: string | null) => (name ? `Into the ${stage.toLowerCase()} against ${name}` : `Into the ${stage.toLowerCase()}`),
    champion: "Champion of the cup",
    standing: (place: number | null, points: number) => `${place === null ? "Unranked" : ordinal(place, "en")} · ${points} ${points === 1 ? "point" : "points"}`,
    you: "You",
    team: (name: string) => `${name}'s team`,
    noTeam: "No team on the site yet",
    uploadFor: (milestone: string) => `Upload your ${milestone} snapshot to get your cup team`,
    toSeries: "Upload it on the series page",
    waitingFor: (name: string, milestone: string) => `Waiting for ${name}'s ${milestone} snapshot`,
    hiddenLocked: (name: string) => `${name} has locked their team`,
    hiddenBuilding: (name: string) => `${name} is building their team`,
    reveal: { all: "It shows once every cup player has locked theirs", both: "It shows once both players have locked theirs", result: "It shows once the match has its result" },
    openTeam: (team: string) => `Open ${team}`,
    locked: "Locked",
    toBuild: "To build",
    empty: "Empty",
    games: "Games",
    game: (n: number | null) => (n === null ? "Game" : `Game ${n}`),
    won: (name: string) => `${name} won`,
    gameSub: (name: string, a: number, b: number) => `${name} won · ${a}–${b} fainted`,
    noReplay: "No replay",
    toPlay: "To play",
    ifNeeded: "If needed",
    notNeeded: "Not needed",
    replay: "Replay",
    edit: "Edit",
    editGame: (n: number | null) => (n === null ? "Edit game" : `Edit game ${n}`),
    result: "Result",
    sideState: (games: number, fainted: number) => `${games} ${games === 1 ? "game" : "games"} · ${fainted} fainted`,
    wins: (name: string, a: number, b: number) => `${name} wins ${a}–${b}`,
    point: (n: number) => `${n} ${n === 1 ? "point" : "points"}`,
    recordTitle: (n: number) => `Game ${n} result`,
    winner: "Winner",
    fainted: (name: string) => `${name} fainted`,
    fewer: (label: string) => `One fewer for ${label}`,
    more: (label: string) => `One more for ${label}`,
    replayLink: "Replay link",
    cancel: "Cancel",
    record: (n: number) => `Record game ${n}`,
    save: (n: number | null) => (n === null ? "Save game" : `Save game ${n}`),
  },
  es: {
    failed: "Algo ha fallado",
    breadcrumb: "Ruta de navegación",
    series: (n: number) => `Serie ${n}`,
    league: "Liga",
    round: (n: number) => `Ronda ${n}`,
    stage: (n: number) => `Ronda ${n} · Bo3`,
    cup: (stage: string) => `Copa · ${stage}`,
    cupStage: (stage: string) => `${stage} · Bo3`,
    seed: (n: number) => `Cabeza de serie ${n}`,
    onward: (stage: string, name: string | null) => (name ? `Siguiente: ${stage.toLowerCase()} contra ${name}` : `Siguiente: ${stage.toLowerCase()}`),
    champion: "Campeón de la copa",
    standing: (place: number | null, points: number) => `${place === null ? "Sin puesto" : ordinal(place, "es")} · ${points} ${points === 1 ? "punto" : "puntos"}`,
    you: "Tú",
    team: (name: string) => `Equipo de ${name}`,
    noTeam: "Aún no hay equipo en la web",
    uploadFor: (milestone: string) => `Sube tu captura de ${milestone} para tener tu equipo de copa`,
    toSeries: "Súbela en la página de la serie",
    waitingFor: (name: string, milestone: string) => `Esperando la captura de ${milestone} de ${name}`,
    hiddenLocked: (name: string) => `${name} ha bloqueado su equipo`,
    hiddenBuilding: (name: string) => `${name} está montando su equipo`,
    reveal: {
      all: "Se verá cuando todos los jugadores de la copa hayan bloqueado el suyo",
      both: "Se verá cuando los dos jugadores hayan bloqueado el suyo",
      result: "Se verá cuando el enfrentamiento tenga su resultado",
    },
    openTeam: (team: string) => `Abrir ${team}`,
    locked: "Bloqueado",
    toBuild: "Por montar",
    empty: "Vacío",
    games: "Partidas",
    game: (n: number | null) => (n === null ? "Partida" : `Partida ${n}`),
    won: (name: string) => `Ganó ${name}`,
    gameSub: (name: string, a: number, b: number) => `Ganó ${name} · ${a}–${b} debilitados`,
    noReplay: "Sin repetición",
    toPlay: "Por jugar",
    ifNeeded: "Si hace falta",
    notNeeded: "No hizo falta",
    replay: "Repetición",
    edit: "Editar",
    editGame: (n: number | null) => (n === null ? "Editar la partida" : `Editar la partida ${n}`),
    result: "Resultado",
    sideState: (games: number, fainted: number) => `${games} ${games === 1 ? "partida" : "partidas"} · ${fainted} debilitados`,
    wins: (name: string, a: number, b: number) => `${name} gana ${a}–${b}`,
    point: (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`,
    recordTitle: (n: number) => `Resultado de la partida ${n}`,
    winner: "Ganador",
    fainted: (name: string) => `Debilitados de ${name}`,
    fewer: (label: string) => `Uno menos en ${label}`,
    more: (label: string) => `Uno más en ${label}`,
    replayLink: "Enlace a la repetición",
    cancel: "Cancelar",
    record: (n: number) => `Anotar la partida ${n}`,
    save: (n: number | null) => (n === null ? "Guardar la partida" : `Guardar la partida ${n}`),
  },
});

function ordinal(n: number, lang: "en" | "es"): string {
  if (lang === "es") return `${n}.º`;
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

const FROM = "/series/$number/league/matches/$id";

function numbered(match: MatchPage, n: number): number | null {
  return match.unrecorded.a + match.unrecorded.b === 0 ? n : null;
}

function afterWin(match: MatchPage): string {
  if (match.round) return `${t.round(match.round.number)} · ${t.point(POINTS_PER_WIN)}`;
  if (!match.cup) return "";
  if (match.cup.onward) return t.onward(stageName({ kind: "bracket", left: match.cup.onward.left, group: match.cup.group }, true), match.cup.onward.opponent);
  return match.cup.kind === "group" ? stageName(match.cup) : t.champion;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

export function LeagueMatchPage() {
  const { number, id } = useParams({ from: FROM });
  const { data: session } = authClient.useSession();
  const [match, setMatch] = useState<MatchPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    setMatch(null);
    setError(null);
    setEditing(null);
    api(`/series/${encodeURIComponent(number)}/league/matches/${encodeURIComponent(id)}`, matchPage).then(setMatch, (caught: unknown) => setError(message(caught)));
  }, [number, id]);

  if (error) {
    return (
      <main className={cn(listPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!match) return <MatchFrame />;

  const me = session?.user.id ?? null;
  const decided = match.gamesA !== null && match.gamesB !== null;
  const sum = tally({ a: match.a.id, b: match.b.id }, match.games);
  const scoreA = decided ? match.gamesA! : sum.gamesA;
  const scoreB = decided ? match.gamesB! : sum.gamesB;
  const nameOf = (player: string) => (player === match.a.id ? match.a.name : match.b.name);
  const saved = (next: MatchPage) => {
    setMatch(next);
    setEditing(null);
  };

  return (
    <main className={cn(listPage, "gap-4 pt-4 pb-8 sm:gap-4.5 sm:pt-4.5 sm:pb-8")}>
      <nav aria-label={t.breadcrumb} className="flex flex-wrap items-center gap-2 font-heading text-lg text-muted-foreground sm:gap-2.5 sm:text-[1.375rem]">
        <Link to="/series/$number" params={{ number: String(match.number) }} className="text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          {t.series(match.number)}
        </Link>
        <Chevron />
        <Link
          to="/series/$number/league"
          params={{ number: String(match.number) }}
          search={match.cup ? { view: "cup" } : {}}
          className="text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t.league}
        </Link>
        <Chevron />
        <span>{match.round ? t.round(match.round.number) : match.cup ? t.cup(stageName(match.cup, true)) : null}</span>
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <Side side={match.a} you={match.a.id === me} />
        <h1 className="m-0 flex flex-col items-center gap-0.5 font-heading font-normal">
          <span className="text-[0.9375rem] whitespace-nowrap text-muted-foreground sm:text-xl">{match.round ? t.stage(match.round.number) : match.cup ? t.cupStage(stageName(match.cup, true)) : null}</span>
          <span className="text-5xl leading-[0.85] whitespace-nowrap text-white sm:text-[4.75rem]">
            {scoreA} – {scoreB}
          </span>
        </h1>
        <Side side={match.b} you={match.b.id === me} end />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)_minmax(0,430px)] lg:gap-5">
        <section aria-label={t.games} className="flex flex-col gap-3 lg:order-2">
          <GameSlots match={match} decided={decided} editing={editing} onEdit={setEditing} nameOf={nameOf} />
          <ResultPanel match={match} decided={decided} sum={sum} editing={editing} onCancel={() => setEditing(null)} onSaved={saved} nameOf={nameOf} />
        </section>
        <TeamColumn number={match.number} name={match.a.name} team={match.teams.a} you={match.a.id === me} className="lg:order-1" />
        <TeamColumn number={match.number} name={match.b.name} team={match.teams.b} you={match.b.id === me} className="lg:order-3" />
      </div>
    </main>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 14 18" aria-hidden="true" className="h-2.5 w-1.75 fill-faint sm:h-3 sm:w-2">
      <path d="M2 2l10 7-10 7z" />
    </svg>
  );
}

function Side({ side, you, end = false }: { side: MatchPage["a"]; you: boolean; end?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4", end ? "items-end sm:flex-row-reverse" : "items-start")}>
      <PlayerBadge name={side.name} colour={playerColour(side.name)} size="row" />
      <span className={cn("flex min-w-0 flex-col leading-none", end ? "items-end" : "items-start")}>
        <span className={cn("flex max-w-full items-center gap-2.5", end && "flex-row-reverse")}>
          <span className="truncate font-heading text-[1.75rem] leading-[0.95] sm:text-5xl">{side.name}</span>
          {you && <span className="rounded-sm bg-yellow px-1.5 font-heading text-[0.9375rem] text-ink sm:text-base">{t.you}</span>}
        </span>
        <span className="font-heading text-[1.0625rem] leading-[1.1] text-muted-foreground sm:text-xl">{side.seed === null ? t.standing(side.place, side.points) : t.seed(side.seed)}</span>
      </span>
    </div>
  );
}

function TeamColumn({ number, name, team, you, className }: { number: number; name: string; team: MatchTeam; you: boolean; className?: string }) {
  return (
    <section aria-label={t.team(name)} className={cn("flex flex-col gap-2", className)}>
      <h2 className="m-0 px-0.5 font-heading text-[1.625rem] leading-none font-normal lg:sr-only">{t.team(name)}</h2>
      {team.state === "shown" ? (
        <>
          <ol aria-label={team.name} className="m-0 grid list-none grid-cols-2 gap-2 p-0">
            {team.members.map((member, at) => (
              <li key={at} className="flex min-w-0">
                {member ? (
                  <MemberTile member={member} />
                ) : (
                  <span className="grid min-h-22 flex-1 place-items-center rounded-[14px] border-3 border-dashed font-heading text-lg text-faint">{t.empty}</span>
                )}
              </li>
            ))}
          </ol>
          <span className="flex flex-wrap items-center gap-2 px-0.5">
            <Link
              to="/teams/$id"
              params={{ id: team.id }}
              className="min-w-0 truncate font-heading text-xl text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t.openTeam(team.name)}
            </Link>
            {team.locked ? (
              <span className="flex h-5.5 items-center gap-1.25 rounded-[5px] border-2 border-cell-hi bg-ink px-2 font-heading text-[1.0625rem] leading-none text-subtle">
                <PixelIcon name="lock" className="size-3" />
                {t.locked}
              </span>
            ) : (
              <span className="flex h-5.5 items-center rounded-[5px] bg-round px-2 font-heading text-[1.0625rem] leading-none text-white">{t.toBuild}</span>
            )}
          </span>
        </>
      ) : (
        <div className="grid min-h-24 flex-1 place-items-center content-center gap-2 rounded-[14px] border-3 border-dashed bg-box px-4 py-4 text-center font-heading text-xl text-faint lg:min-h-80">
          {team.state === "none" && <p className="m-0">{t.noTeam}</p>}
          {team.state === "waiting" && you && (
            <>
              <p className="m-0 text-subtle">{t.uploadFor(team.milestone)}</p>
              <Link
                to="/series/$number"
                params={{ number: String(number) }}
                className="text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t.toSeries}
              </Link>
            </>
          )}
          {team.state === "waiting" && !you && <p className="m-0">{t.waitingFor(name, team.milestone)}</p>}
          {team.state === "hidden" && (
            <>
              <p className="m-0 text-subtle">{team.locked ? t.hiddenLocked(name) : t.hiddenBuilding(name)}</p>
              <p className="m-0">{t.reveal[team.reveal]}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function MemberTile({ member }: { member: MatchMember }) {
  const item = member.item ? dexName("items", member.item.id, member.item.name) : null;
  return (
    <span className="flex min-h-22 min-w-0 flex-1 items-center gap-2 rounded-[14px] border-3 bg-card py-1.5 pr-2.5 pl-1">
      {member.sprite ? (
        <img src={member.sprite} alt="" className="size-14 flex-none [image-rendering:pixelated] sm:size-19" />
      ) : (
        <span aria-hidden="true" className="size-14 flex-none sm:size-19" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="truncate font-heading text-2xl leading-none">{member.nickname ?? member.species}</span>
        <span className="truncate text-[0.8125rem] font-bold text-muted-foreground">{[member.nickname ? member.species : null, item].filter(Boolean).join(" · ")}</span>
        <span className="flex flex-wrap gap-1">
          {member.types.map((type) => (
            <TypeTag key={type} type={type} className="px-1.5 text-[0.9375rem] leading-[19px]" />
          ))}
        </span>
      </span>
    </span>
  );
}

type Slot = { key: string; title: string; sub: string; kind: "played" | "unrecorded" | "next" | "later"; game?: MatchPage["games"][number] };

function slotsOf(match: MatchPage, decided: boolean, nameOf: (id: string) => string): Slot[] {
  const slots: Slot[] = match.games.map((game) => ({
    key: `g${game.number}`,
    title: t.game(numbered(match, game.number)),
    sub: t.gameSub(nameOf(game.winner), game.faintedA, game.faintedB),
    kind: "played",
    game,
  }));
  for (const [player, count] of [
    [match.a.id, match.unrecorded.a],
    [match.b.id, match.unrecorded.b],
  ] as const) {
    for (let i = 0; i < count; i++) slots.push({ key: `u${player}${i}`, title: t.noReplay, sub: t.won(nameOf(player)), kind: "unrecorded" });
  }
  for (let n = slots.length + 1; n <= MATCH_GAMES; n++) {
    slots.push(
      n === match.next
        ? { key: `n${n}`, title: t.game(n), sub: t.toPlay, kind: "next" }
        : { key: `n${n}`, title: t.game(n), sub: decided ? t.notNeeded : t.ifNeeded, kind: "later" },
    );
  }
  return slots;
}

function GameSlots({
  match,
  decided,
  editing,
  onEdit,
  nameOf,
}: {
  match: MatchPage;
  decided: boolean;
  editing: number | null;
  onEdit: (n: number) => void;
  nameOf: (id: string) => string;
}) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0">
      {slotsOf(match, decided, nameOf).map((slot) => {
        const open = slot.game !== undefined && slot.game.number === editing;
        return (
          <li
            key={slot.key}
            className={cn(
              "flex min-h-18 flex-col gap-0.5 rounded-xl border-3 px-2 pt-1.5 pb-2 sm:px-3 sm:pt-2",
              slot.kind === "played" && (open ? "border-primary bg-primary/10" : "bg-card"),
              slot.kind === "unrecorded" && "border-dashed bg-card",
              slot.kind === "next" && "border-primary bg-primary/10",
              slot.kind === "later" && "border-dashed bg-transparent",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("flex-1 font-heading text-xl sm:text-[1.375rem]", slot.kind === "later" || slot.kind === "unrecorded" ? "text-faint" : "text-white")}>{slot.title}</span>
              {match.admin && slot.game && !open && (
                <button
                  type="button"
                  aria-label={t.editGame(numbered(match, slot.game.number))}
                  onClick={() => onEdit(slot.game!.number)}
                  className="min-h-6.5 cursor-pointer rounded-md bg-cell px-2 font-heading text-base text-subtle outline-none hover:bg-primary hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t.edit}
                </button>
              )}
            </span>
            <span
              className={cn(
                "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-[1.35] font-bold sm:gap-2 sm:text-sm",
                slot.kind === "next" ? "text-primary" : slot.kind === "later" ? "text-faint" : "text-subtle",
              )}
            >
              {slot.sub}
              {slot.game?.replay && (
                <a
                  href={slot.game.replay}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-cell px-1.75 font-heading text-base font-normal text-subtle no-underline outline-none hover:bg-primary hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t.replay}
                </a>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ResultPanel({
  match,
  decided,
  sum,
  editing,
  onCancel,
  onSaved,
  nameOf,
}: {
  match: MatchPage;
  decided: boolean;
  sum: ReturnType<typeof tally>;
  editing: number | null;
  onCancel: () => void;
  onSaved: (next: MatchPage) => void;
  nameOf: (id: string) => string;
}) {
  const editGame = editing === null ? undefined : match.games.find((g) => g.number === editing);
  const formFor = editGame?.number ?? (match.admin ? match.next : null);
  const winner = decided ? (match.gamesA! > match.gamesB! ? match.a : match.b) : null;
  const sides = [
    { side: match.a, games: decided ? match.gamesA! : sum.gamesA, fainted: decided ? (match.faintedA ?? sum.faintedA) : sum.faintedA },
    { side: match.b, games: decided ? match.gamesB! : sum.gamesB, fainted: decided ? (match.faintedB ?? sum.faintedB) : sum.faintedB },
  ];
  return (
    <section
      aria-labelledby="result-title"
      className={cn(
        "flex flex-1 flex-col gap-3.5 rounded-[18px] border-3 bg-card p-4 sm:gap-4 sm:px-5.5 sm:pt-5 sm:pb-5.5",
        editGame ? "border-primary" : decided ? "border-trophy-rim" : "border-border",
      )}
    >
      <h2 id="result-title" className="m-0 font-heading text-[1.75rem] leading-none font-normal sm:text-[2.125rem]">
        {decided || match.next === null ? t.result : t.game(match.next)}
      </h2>
      <div className="flex flex-col gap-2">
        {sides.map(({ side, games, fainted }) => {
          const won = winner?.id === side.id;
          return (
            <div key={side.id} className={cn("flex min-h-13 items-center gap-3 rounded-xl border-3 bg-box px-3 sm:min-h-14 sm:px-3.5", won ? "border-trophy-rim" : "border-border")}>
              <PlayerBadge name={side.name} colour={playerColour(side.name)} size="xs" />
              <span className="font-heading text-2xl">{side.name}</span>
              <span className="flex-1" />
              <span className={cn("flex items-center gap-2 font-heading text-[1.375rem]", won ? "text-yellow" : "text-muted-foreground")}>
                {won && <Check />}
                {t.sideState(games, fainted)}
              </span>
            </div>
          );
        })}
      </div>
      {formFor !== null && formFor !== undefined ? (
        <GameForm key={`${formFor}-${editGame ? "edit" : "new"}`} match={match} number={formFor} game={editGame} onCancel={editGame ? onCancel : undefined} onSaved={onSaved} nameOf={nameOf} />
      ) : (
        winner && (
          <div className="mt-auto flex items-center gap-4 rounded-[14px] border-3 border-trophy-rim bg-trophy px-4.5 py-4">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-10 flex-none fill-yellow">
              <path d="M7 3h10v5a5 5 0 0 1-10 0z" />
              <path d="M10 13h4v4h3v4H7v-4h3z" />
            </svg>
            <span className="flex flex-col leading-[1.1]">
              <span className="font-heading text-3xl text-yellow">{t.wins(winner.name, Math.max(match.gamesA!, match.gamesB!), Math.min(match.gamesA!, match.gamesB!))}</span>
              <span className="font-heading text-xl text-subtle">
                {afterWin(match)}
              </span>
            </span>
          </div>
        )
      )}
    </section>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" className="size-4 fill-current">
      <path d="M8 2h2v2H8zM7 3h2v2H7zM6 4h2v2H6zM5 5h2v2H5zM4 6h2v2H4zM3 7h2v1H3zM1 5h2v2H1zM2 6h2v2H2z" />
    </svg>
  );
}

function GameForm({
  match,
  number,
  game,
  onCancel,
  onSaved,
  nameOf,
}: {
  match: MatchPage;
  number: number;
  game: MatchPage["games"][number] | undefined;
  onCancel: (() => void) | undefined;
  onSaved: (next: MatchPage) => void;
  nameOf: (id: string) => string;
}) {
  const [winner, setWinner] = useState<string | null>(game?.winner ?? null);
  const [faintedA, setFaintedA] = useState(game?.faintedA ?? 0);
  const [faintedB, setFaintedB] = useState(game?.faintedB ?? 0);
  const [replay, setReplay] = useState(game?.replay ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!winner) return;
    setBusy(true);
    setError(null);
    const input: GameInput = { winner, faintedA, faintedB, replay: replay.trim() === "" ? null : replay.trim() };
    const path = `/series/${match.number}/league/matches/${encodeURIComponent(match.id)}/games`;
    try {
      onSaved(await api(game ? `${path}/${number}` : path, matchPage, { method: game ? "PUT" : "POST", body: input }));
    } catch (caught) {
      setError(message(caught));
      setBusy(false);
    }
  };

  const steppers = [
    { label: t.fainted(match.a.name), value: faintedA, set: setFaintedA },
    { label: t.fainted(match.b.name), value: faintedB, set: setFaintedB },
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="mt-auto flex flex-col gap-3 border-t-3 border-dashed pt-3.5"
    >
      <span className="font-heading text-[1.375rem] text-muted-foreground">
        {game ? t.game(numbered(match, number)) : t.recordTitle(number)}
      </span>
      <div role="radiogroup" aria-label={t.winner} className="grid grid-cols-2 gap-1 rounded-xl border-3 bg-ink p-1">
        {[match.a.id, match.b.id].map((player) => (
          <button
            key={player}
            type="button"
            role="radio"
            aria-checked={winner === player}
            onClick={() => setWinner(player)}
            className={cn(
              "min-h-11 cursor-pointer rounded-lg font-heading text-[1.375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              winner === player ? "bg-border text-white" : "text-muted-foreground hover:bg-cell hover:text-white",
            )}
          >
            {t.won(nameOf(player))}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {steppers.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 rounded-[10px] border-3 bg-box py-1 pr-1 pl-3">
            <span className="min-w-0 flex-1 truncate font-heading text-[1.1875rem] text-muted-foreground">{s.label}</span>
            <button
              type="button"
              aria-label={t.fewer(s.label)}
              disabled={s.value === 0}
              onClick={() => s.set(Math.max(0, s.value - 1))}
              className="size-9 cursor-pointer rounded-lg bg-ink font-heading text-2xl text-primary outline-none hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:text-faint"
            >
              −
            </button>
            <output aria-live="polite" className="w-5.5 text-center font-heading text-[1.625rem]">
              {s.value}
            </output>
            <button
              type="button"
              aria-label={t.more(s.label)}
              disabled={s.value === FAINTED_PER_GAME}
              onClick={() => s.set(Math.min(FAINTED_PER_GAME, s.value + 1))}
              className="size-9 cursor-pointer rounded-lg bg-ink font-heading text-2xl text-primary outline-none hover:bg-cell focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:text-faint"
            >
              +
            </button>
          </div>
        ))}
      </div>
      <label className="flex min-h-12 items-center gap-2.5 rounded-[10px] border-3 bg-ink px-3.5 focus-within:border-primary">
        <span className="font-heading text-[1.1875rem] text-muted-foreground">{t.replay}</span>
        <input
          type="url"
          value={replay}
          onChange={(event) => setReplay(event.target.value)}
          aria-label={t.replayLink}
          placeholder="https://replay.pokemonshowdown.com/…"
          className="min-w-0 flex-1 border-none bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-faint"
        />
      </label>
      {error && (
        <p role="alert" className="m-0 text-sm font-bold text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" onClick={onCancel} className="min-h-13 flex-1 text-[1.625rem]">
            {t.cancel}
          </Button>
        )}
        <Button type="submit" variant="go" disabled={!winner || busy} className="min-h-13 flex-2 text-[1.625rem]">
          {game ? t.save(numbered(match, number)) : t.record(number)}
        </Button>
      </div>
    </form>
  );
}
