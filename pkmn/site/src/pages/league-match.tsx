import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { listPage, toolPage } from "@/components/page";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { MatchFrame } from "@/components/page-frames";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Placeholder } from "@/components/placeholder";
import { SummaryBody, SummaryHead } from "@/components/pc/summary";
import { GameIconsProvider } from "@/lib/item-icons";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { ordinal } from "@/lib/records";
import { stageName } from "@/league/cup";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";
import { PixelIcon } from "@/components/pixel-icon";
import { TypeTag } from "@/components/pc/summary";
import { dexName } from "../../shared/dex-text";
import {
  CUP_BROUGHT,
  FAINTED_PER_GAME,
  type GameDraft,
  type GameInput,
  MATCH_GAMES,
  type MatchMember,
  type MatchPage,
  matchPage,
  type MatchTeam,
  POINTS_PER_WIN,
  SHOWDOWN_CLAUSES,
  SHOWDOWN_FORMAT,
  tally,
} from "../../shared/league";
import { teamPage, type TeamPage } from "../../shared/team";
import { liveSlots } from "@/teams/dex";
import { analysedSlots } from "@/teams/pick";
import { showdownTeam } from "@/teams/showdown";
import { stockOf } from "@/teams/team";
import { slotSummary } from "@/teams/summary";

const t = messages({
  en: {
    failed: "Something went wrong",
    breadcrumb: "Breadcrumb",
    series: (n: number) => `Series ${n}`,
    league: "League",
    round: (n: number) => `Round ${n}`,
    stage: (n: number) => `Round ${n} · Bo${MATCH_GAMES}`,
    cup: (stage: string) => `Cup · ${stage}`,
    cupStage: (stage: string) => `${stage} · Bo${MATCH_GAMES}`,
    seed: (n: number) => `Seed ${n}`,
    onward: (stage: string, name: string | null) => (name ? `Into the ${stage.toLowerCase()} against ${name}` : `Into the ${stage.toLowerCase()}`),
    champion: "Champion of the cup",
    standing: (place: number | null, points: number) => `${place === null ? "Unranked" : ordinal(place, "en")} · ${points} ${points === 1 ? "point" : "points"}`,
    you: "You",
    team: (name: string) => `${name}'s team`,
    noTeam: "No team on the site yet",
    uploadFor: (milestone: string, round: boolean) => `Upload your ${milestone} snapshot to get your ${round ? "round" : "cup"} team`,
    toSeries: "Upload it on the series page",
    waitingFor: (name: string, milestone: string) => `Waiting for ${name}'s ${milestone} snapshot`,
    hiddenLocked: (name: string) => `${name} has locked their team`,
    hiddenBuilding: (name: string) => `${name} is building their team`,
    reveal: { all: "It shows once every cup player has locked theirs", both: "It shows once both players have locked theirs", result: "It shows once the match has its result" },
    openTeam: (team: string) => `Open ${team}`,
    locked: "Locked",
    toBuild: "To build",
    empty: "Empty",
    look: (name: string) => `${name}'s summary`,
    summary: "Summary",
    heldItem: "Held item",
    close: "Close",
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
    bansTitle: (n: number) => `Game ${n} · Bans`,
    yourSix: (n: number) => `Game ${n} · Your ${CUP_BROUGHT}`,
    pickingSix: (n: number) => `Game ${n} · Picking ${CUP_BROUGHT}`,
    playTitle: (n: number) => `Game ${n} · Play`,
    bansSub: "Bans",
    pickingSub: `Picking ${CUP_BROUGHT}`,
    playingSub: "Playing",
    choosing: "Choosing",
    banned: "Banned",
    sixIn: `${CUP_BROUGHT} in`,
    yourBan: "Your ban",
    ban: "Ban",
    banName: (name: string) => `Ban ${name}`,
    barred: (n: number) => `Your game ${n} ban`,
    waitingOn: (name: string) => `Waiting for ${name}`,
    picked: (n: number, of: number) => `${n} of ${of} in`,
    confirmSix: `Confirm these ${CUP_BROUGHT}`,
    notBrought: "Not brought",
    onShowdown: "On Showdown",
    clauses: (clauses: readonly string[]) => [...clauses, "team preview"].join(" · "),
    copySix: `Copy my ${CUP_BROUGHT} for Showdown`,
    copied: "Copied",
    copyFailed: "Copy failed",
  },
  es: {
    failed: "Algo ha fallado",
    breadcrumb: "Ruta de navegación",
    series: (n: number) => `Serie ${n}`,
    league: "Liga",
    round: (n: number) => `Ronda ${n}`,
    stage: (n: number) => `Ronda ${n} · Bo${MATCH_GAMES}`,
    cup: (stage: string) => `Copa · ${stage}`,
    cupStage: (stage: string) => `${stage} · Bo${MATCH_GAMES}`,
    seed: (n: number) => `Cabeza de serie ${n}`,
    onward: (stage: string, name: string | null) => (name ? `Siguiente: ${stage.toLowerCase()} contra ${name}` : `Siguiente: ${stage.toLowerCase()}`),
    champion: "Campeón de la copa",
    standing: (place: number | null, points: number) => `${place === null ? "Sin puesto" : ordinal(place, "es")} · ${points} ${points === 1 ? "punto" : "puntos"}`,
    you: "Tú",
    team: (name: string) => `Equipo de ${name}`,
    noTeam: "Aún no hay equipo en la web",
    uploadFor: (milestone: string, round: boolean) => `Sube tu captura de ${milestone} para tener tu equipo de ${round ? "ronda" : "copa"}`,
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
    look: (name: string) => `Resumen de ${name}`,
    summary: "Resumen",
    heldItem: "Objeto",
    close: "Cerrar",
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
    bansTitle: (n: number) => `Partida ${n} · Vetos`,
    yourSix: (n: number) => `Partida ${n} · Tus ${CUP_BROUGHT}`,
    pickingSix: (n: number) => `Partida ${n} · Eligiendo ${CUP_BROUGHT}`,
    playTitle: (n: number) => `Partida ${n} · A jugar`,
    bansSub: "Vetos",
    pickingSub: `Eligiendo ${CUP_BROUGHT}`,
    playingSub: "Jugando",
    choosing: "Eligiendo",
    banned: "Vetado",
    sixIn: `${CUP_BROUGHT} elegidos`,
    yourBan: "Tu veto",
    ban: "Vetar",
    banName: (name: string) => `Vetar a ${name}`,
    barred: (n: number) => `Tu veto de la partida ${n}`,
    waitingOn: (name: string) => `Esperando a ${name}`,
    picked: (n: number, of: number) => `${n} de ${of} elegidos`,
    confirmSix: `Confirmar estos ${CUP_BROUGHT}`,
    notBrought: "No va",
    onShowdown: "En Showdown",
    clauses: (clauses: readonly string[]) => [...clauses, "vista previa de equipos"].join(" · "),
    copySix: `Copiar mis ${CUP_BROUGHT} para Showdown`,
    copied: "Copiado",
    copyFailed: "No se pudo copiar",
  },
});

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

const REFRESH_MS = 5000;

type SideKey = "a" | "b";

type Phase = "ban" | "pick" | "play" | "done";

const otherSide = (side: SideKey): SideKey => (side === "a" ? "b" : "a");

function phaseOf(match: MatchPage): Phase | null {
  const draft = match.draft;
  if (!draft) return null;
  if (!draft.open) return match.games.some((g) => g.number === draft.number) ? "done" : null;
  if (draft.bans && !(draft.a.banned && draft.b.banned)) return "ban";
  if (!(draft.a.picked && draft.b.picked)) return "pick";
  return "play";
}

type Tone = "plain" | "chosen" | "banned" | "picked" | "unpicked" | "brought" | "dim";

type Mark = {
  tone: Tone;
  tag?: { text: string; tone: "red" | "muted" | "warn" };
  check?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
};

type Choice = { key: string; ban: number | null; six: number[] | null };

function filledOf(team: MatchTeam): number[] {
  return team.state === "shown" ? team.members.flatMap((member, at) => (member ? [at] : [])) : [];
}

function memberName(team: MatchTeam, at: number | null): string | null {
  if (team.state !== "shown" || at === null) return null;
  const member = team.members[at];
  return member ? (member.nickname ?? member.species) : null;
}

function memberSprite(team: MatchTeam, at: number | null): string | null {
  return team.state === "shown" && at !== null ? (team.members[at]?.sprite ?? null) : null;
}

export function LeagueMatchPage() {
  const { number, id } = useParams({ from: FROM });
  const { data: session } = authClient.useSession();
  const [match, setMatch] = useState<MatchPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [choice, setChoice] = useState<Choice>({ key: "", ban: null, six: null });
  const path = `/series/${encodeURIComponent(number)}/league/matches/${encodeURIComponent(id)}`;
  const live = match?.draft?.open ?? false;

  useEffect(() => {
    setMatch(null);
    setError(null);
    setEditing(null);
    api(path, matchPage).then(setMatch, (caught: unknown) => setError(message(caught)));
  }, [path]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api(path, matchPage).then(setMatch, () => undefined);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, path]);

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

  const draft = match.draft;
  const phase = phaseOf(match);
  const mine: SideKey | null = me === match.a.id ? "a" : me === match.b.id ? "b" : null;
  const theirs = mine && otherSide(mine);
  const key = draft ? `${draft.number}:${phase}` : "";
  const banning = phase === "ban" && !!draft && !!mine && !draft[mine].banned && match.teams[theirs!].state === "shown";
  const picking = phase === "pick" && !!draft && !!mine && !draft[mine].picked && match.teams[mine].state === "shown";
  const banChoice = choice.key === key ? choice.ban : null;
  const defaultSix = mine && draft ? filledOf(match.teams[mine]).filter((at) => at !== draft[theirs!].ban).slice(0, CUP_BROUGHT) : [];
  const sixChoice = choice.key === key && choice.six ? choice.six : defaultSix;

  const markOf = (side: SideKey) => {
    if (!draft || !phase) return undefined;
    const other = otherSide(side);
    const team = match.teams[side];
    return (at: number): Mark | undefined => {
      const member = team.state === "shown" ? team.members[at] : null;
      const name = member ? (member.nickname ? `${member.nickname}, ${member.species}` : member.species) : "";
      if (phase === "ban") {
        if (banning && side === theirs) {
          if (at === draft[mine!].barred) return { tone: "dim", tag: { text: t.barred(draft.number - 1), tone: "warn" } };
          const on = banChoice === at;
          return {
            tone: on ? "chosen" : "plain",
            tag: on ? { text: t.ban, tone: "red" } : undefined,
            onClick: () => setChoice({ key, ban: on ? null : at, six: null }),
            label: name,
          };
        }
        if (mine && side === theirs && draft[mine].ban === at) return { tone: "chosen", tag: { text: t.yourBan, tone: "red" } };
        return undefined;
      }
      if (draft[other].ban === at) return { tone: "banned", tag: { text: t.banned, tone: "red" } };
      if (picking && side === mine) {
        const on = sixChoice.includes(at);
        const full = sixChoice.length >= CUP_BROUGHT;
        return {
          tone: on ? "picked" : "unpicked",
          check: on,
          disabled: !on && full,
          onClick: () => setChoice({ key, ban: null, six: on ? sixChoice.filter((x) => x !== at) : [...sixChoice, at] }),
          label: name,
        };
      }
      const picks = draft[side].picks;
      if (!picks) return undefined;
      return picks.includes(at) ? { tone: "brought" } : { tone: "dim", tag: { text: t.notBrought, tone: "muted" } };
    };
  };

  const acting: SideKey | null = banning ? theirs : picking ? mine : null;
  const teamOrder = (side: SideKey) => (acting === side ? "order-2" : "order-4");

  return (
    <main className={cn(toolPage, "gap-4 pt-4 pb-8 sm:gap-4.5 sm:pt-4.5 sm:pb-8")}>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)_minmax(0,430px)] lg:grid-rows-[auto_1fr] lg:gap-x-5 lg:gap-y-3 2xl:flex-1 2xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)_minmax(0,1fr)]">
        <section aria-label={t.games} className="order-1 lg:col-start-2 lg:row-start-1">
          <GameSlots match={match} decided={decided} phase={phase} editing={editing} onEdit={setEditing} nameOf={nameOf} />
        </section>
        <ResultPanel
          match={match}
          decided={decided}
          sum={sum}
          phase={phase}
          mine={mine}
          banChoice={banChoice}
          sixChoice={sixChoice}
          editing={editing}
          onCancel={() => setEditing(null)}
          onSaved={saved}
          onMoved={setMatch}
          nameOf={nameOf}
          className="order-3 lg:col-start-2 lg:row-start-2"
        />
        <TeamColumn
          number={match.number}
          round={match.round !== null}
          name={match.a.name}
          team={match.teams.a}
          you={match.a.id === me}
          mark={markOf("a")}
          className={cn(teamOrder("a"), "lg:col-start-1 lg:row-span-2 lg:row-start-1")}
        />
        <TeamColumn
          number={match.number}
          round={match.round !== null}
          name={match.b.name}
          team={match.teams.b}
          you={match.b.id === me}
          mark={markOf("b")}
          className={cn(teamOrder("b"), "lg:col-start-3 lg:row-span-2 lg:row-start-1")}
        />
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

function TeamColumn({
  number,
  round,
  name,
  team,
  you,
  mark,
  className,
}: {
  number: number;
  round: boolean;
  name: string;
  team: MatchTeam;
  you: boolean;
  mark: ((at: number) => Mark | undefined) | undefined;
  className?: string;
}) {
  const [looking, setLooking] = useState<number | null>(null);
  return (
    <section aria-label={t.team(name)} className={cn("@container flex flex-col gap-2", className)}>
      <h2 className="m-0 px-0.5 font-heading text-[1.625rem] leading-none font-normal lg:sr-only">{t.team(name)}</h2>
      {team.state === "shown" ? (
        <>
          <ol aria-label={team.name} className="m-0 grid list-none grid-cols-2 gap-2 p-0 2xl:flex-1 @min-[54rem]:grid-cols-3">
            {team.members.map((member, at) => (
              <li key={at} className="flex min-w-0">
                {member ? (
                  <MemberTile member={member} mark={mark?.(at)} onLook={() => setLooking(at)} />
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
          <MemberSummary teamId={team.id} slot={looking} item={looking === null ? null : (team.members[looking]?.item ?? null)} onClose={() => setLooking(null)} />
        </>
      ) : (
        <div className="grid min-h-24 flex-1 place-items-center content-center gap-2 rounded-[14px] border-3 border-dashed bg-box px-4 py-4 text-center font-heading text-xl text-faint lg:min-h-80">
          {team.state === "none" && <p className="m-0">{t.noTeam}</p>}
          {team.state === "waiting" && you && (
            <>
              <p className="m-0 text-subtle">{t.uploadFor(team.milestone, round)}</p>
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

const TONES: Record<Tone, string> = {
  plain: "bg-card",
  chosen: "border-destructive bg-destructive/10",
  banned: "border-round-dim bg-round/10 opacity-60",
  picked: "border-green bg-card",
  unpicked: "bg-card opacity-55",
  brought: "border-mult-2 bg-card",
  dim: "bg-card opacity-45",
};

const TAGS = { red: "bg-round text-white", muted: "bg-cell text-muted-foreground", warn: "bg-cell text-warning" };

function MemberTile({ member, mark, onLook }: { member: MatchMember; mark?: Mark; onLook: () => void }) {
  const item = member.item ? dexName("items", member.item.id, member.item.name) : null;
  const name = member.nickname ?? member.species;
  const tone = mark?.tone ?? "plain";
  const body = (
    <>
      {mark?.check !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1.5 left-1.5 z-1 grid size-6 place-items-center rounded-md border-3 text-ink",
            mark.check ? "border-green bg-green" : "border-cell-hi bg-ink",
          )}
        >
          {mark.check && <Check />}
        </span>
      )}
      {member.sprite ? (
        <img
          src={member.sprite}
          alt=""
          className={cn(
            "size-14 flex-none [image-rendering:pixelated] sm:size-19 @min-[36rem]:h-0 @min-[36rem]:min-h-24 @min-[36rem]:w-full @min-[36rem]:grow @min-[36rem]:basis-0 @min-[36rem]:object-contain",
            tone === "banned" && "grayscale",
          )}
        />
      ) : (
        <span aria-hidden="true" className="size-14 flex-none sm:size-19 @min-[36rem]:h-0 @min-[36rem]:min-h-24 @min-[36rem]:w-full @min-[36rem]:grow @min-[36rem]:basis-0" />
      )}
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.75 @min-[36rem]:flex-none @min-[36rem]:flex-row @min-[36rem]:flex-wrap @min-[36rem]:items-center @min-[36rem]:justify-center @min-[36rem]:gap-x-2.5 @min-[36rem]:gap-y-1.5",
          mark?.onClick && "@min-[36rem]:px-8",
        )}
      >
        <span className="max-w-full truncate font-heading text-2xl leading-none @min-[36rem]:text-[2rem]">{name}</span>
        <span className="max-w-full truncate text-[0.8125rem] font-bold text-muted-foreground @min-[36rem]:hidden">{[member.nickname ? member.species : null, item].filter(Boolean).join(" · ")}</span>
        <span className="flex flex-wrap gap-1">
          {member.types.map((type) => (
            <TypeTag key={type} type={type} className="px-1.5 text-[0.9375rem] leading-[19px] @min-[36rem]:px-2 @min-[36rem]:text-lg @min-[36rem]:leading-6" />
          ))}
        </span>
      </span>
      {mark?.tag && (
        <span className={cn("absolute top-2 right-2 rounded-[5px] px-1.75 font-heading text-base leading-5.25", TAGS[mark.tag.tone])}>{mark.tag.text}</span>
      )}
    </>
  );
  const frame = cn(
    "relative flex min-h-22 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[14px] border-3 py-1.5 pr-2.5 pl-1 text-left font-[inherit] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 @min-[36rem]:flex-col @min-[36rem]:items-stretch @min-[36rem]:gap-2 @min-[36rem]:p-3 @min-[36rem]:text-center",
    TONES[tone],
  );
  if (!mark?.onClick) {
    return (
      <button type="button" aria-label={t.look(name)} onClick={onLook} className={cn(frame, "hover:border-primary")}>
        {body}
      </button>
    );
  }
  return (
    <span className="relative flex min-w-0 flex-1">
      <button
        type="button"
        aria-pressed={mark.tone === "chosen" || mark.tone === "picked"}
        aria-label={mark.label}
        disabled={mark.disabled}
        onClick={mark.onClick}
        className={cn(frame, "enabled:hover:border-primary disabled:cursor-default")}
      >
        {body}
      </button>
      <button
        type="button"
        aria-label={t.look(name)}
        onClick={onLook}
        className="absolute right-1.5 bottom-1.5 grid size-8 cursor-pointer place-items-center rounded-lg border-2 border-cell-hi bg-ink text-subtle outline-none hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>
    </span>
  );
}

function MemberSummary({ teamId, slot, item, onClose }: { teamId: string; slot: number | null; item: MatchMember["item"]; onClose: () => void }) {
  const [page, setPage] = useState<TeamPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slot === null || page) return;
    let live = true;
    setError(null);
    api(`/teams/${encodeURIComponent(teamId)}`, teamPage).then(
      (next) => live && setPage(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, [teamId, slot, page]);

  const shown = page && slot !== null ? slotSummary(page, slot) : null;
  return (
    <Dialog open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[90svh] w-95 max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-[18px] border-3 bg-card p-0 ring-0 sm:max-w-95"
      >
        {shown && page ? (
          <GameIconsProvider game={page.sources.find((source) => source.gameId !== null)?.gameId ?? null}>
            <SummaryHead mon={shown.mon} closeRoom title={(text) => <DialogTitle className="m-0 truncate font-heading text-[2.625rem] leading-[0.85] font-normal">{text}</DialogTitle>} />
            {item && (
              <p className="m-0 mx-3.5 mt-3.5 flex flex-none items-baseline gap-3 rounded-xl border-3 border-cell bg-box px-3.5 py-2.5">
                <span className="font-heading text-lg text-muted-foreground">{t.heldItem}</span>
                <span className="font-heading text-[1.375rem] text-white">{dexName("items", item.id, item.name)}</span>
              </p>
            )}
            <SummaryBody key={slot} mon={shown.mon} tms={shown.tms} gaps={shown.gaps} series={shown.series} />
          </GameIconsProvider>
        ) : (
          <>
            <DialogTitle className="sr-only">{t.summary}</DialogTitle>
            {error || page ? (
              <p role="alert" className="m-0 px-5 py-8 text-destructive">
                {error ?? t.failed}
              </p>
            ) : (
              <Placeholder className="m-4 h-96 rounded-xl" />
            )}
          </>
        )}
        <DialogPrimitive.Close
          aria-label={t.close}
          className="absolute top-3 right-3 grid size-10 cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogContent>
    </Dialog>
  );
}

type Slot = { key: string; title: string; sub: string; kind: "played" | "unrecorded" | "next" | "later"; game?: MatchPage["games"][number] };

const NOW_SUB: Record<"ban" | "pick" | "play", string> = { ban: t.bansSub, pick: t.pickingSub, play: t.playingSub };

function slotsOf(match: MatchPage, decided: boolean, phase: Phase | null, nameOf: (id: string) => string): Slot[] {
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
        ? { key: `n${n}`, title: t.game(n), sub: phase && phase !== "done" ? NOW_SUB[phase] : t.toPlay, kind: "next" }
        : { key: `n${n}`, title: t.game(n), sub: decided ? t.notNeeded : t.ifNeeded, kind: "later" },
    );
  }
  return slots;
}

function GameSlots({
  match,
  decided,
  phase,
  editing,
  onEdit,
  nameOf,
}: {
  match: MatchPage;
  decided: boolean;
  phase: Phase | null;
  editing: number | null;
  onEdit: (n: number) => void;
  nameOf: (id: string) => string;
}) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0">
      {slotsOf(match, decided, phase, nameOf).map((slot) => {
        const open = slot.game !== undefined && slot.game.number === editing;
        return (
          <li
            key={slot.key}
            className={cn(
              "flex min-h-18 flex-col gap-0.5 rounded-xl border-3 px-2 pt-1.5 pb-2 sm:px-3 sm:pt-2 2xl:min-h-28 2xl:gap-1.5 2xl:px-4 2xl:pt-3 2xl:pb-3.5",
              slot.kind === "played" && (open ? "border-primary bg-primary/10" : "bg-card"),
              slot.kind === "unrecorded" && "border-dashed bg-card",
              slot.kind === "next" && "border-primary bg-primary/10",
              slot.kind === "later" && "border-dashed bg-transparent",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("flex-1 font-heading text-xl sm:text-[1.375rem] 2xl:text-[2rem]", slot.kind === "later" || slot.kind === "unrecorded" ? "text-faint" : "text-white")}>{slot.title}</span>
              {match.admin && slot.game && !open && (
                <button
                  type="button"
                  aria-label={t.editGame(numbered(match, slot.game.number))}
                  onClick={() => onEdit(slot.game!.number)}
                  className="min-h-6.5 cursor-pointer rounded-md bg-cell px-2 font-heading text-base text-subtle outline-none hover:bg-primary hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 2xl:min-h-8 2xl:px-2.5 2xl:text-lg"
                >
                  {t.edit}
                </button>
              )}
            </span>
            <span
              className={cn(
                "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-[1.35] font-bold sm:gap-2 sm:text-sm 2xl:text-base",
                slot.kind === "next" ? "text-primary" : slot.kind === "later" ? "text-faint" : "text-subtle",
              )}
            >
              {slot.sub}
              {slot.game?.replay && (
                <a
                  href={slot.game.replay}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-cell px-1.75 font-heading text-base font-normal text-subtle no-underline outline-none hover:bg-primary hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 2xl:px-2.5 2xl:text-lg"
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

type Row = { id: string; name: string; state: string; ink: string; line: string; icon: "check" | "wait" | null; sprite: string | null };

function draftRows(match: MatchPage, draft: GameDraft, phase: "ban" | "pick" | "play"): Row[] {
  return (["a", "b"] as const).map((key) => {
    const side = match[key];
    const own = draft[key];
    const base = { id: side.id, name: side.name, sprite: null, line: "border-border" };
    if (phase === "ban") {
      return own.banned
        ? { ...base, state: t.banned, ink: "text-green", line: "border-mult-2", icon: "check" }
        : { ...base, state: t.choosing, ink: "text-warning", icon: "wait" };
    }
    if (phase === "pick" && !own.picked) {
      return draft.bans
        ? { ...base, state: t.banned, ink: "text-coral", icon: null, sprite: memberSprite(match.teams[otherSide(key)], own.ban) }
        : { ...base, state: t.choosing, ink: "text-warning", icon: "wait" };
    }
    return { ...base, state: t.sixIn, ink: "text-green", icon: "check" };
  });
}

function ResultPanel({
  match,
  decided,
  sum,
  phase,
  mine,
  banChoice,
  sixChoice,
  editing,
  onCancel,
  onSaved,
  onMoved,
  nameOf,
  className,
}: {
  match: MatchPage;
  decided: boolean;
  sum: ReturnType<typeof tally>;
  phase: Phase | null;
  mine: SideKey | null;
  banChoice: number | null;
  sixChoice: number[];
  editing: number | null;
  onCancel: () => void;
  onSaved: (next: MatchPage) => void;
  onMoved: (next: MatchPage) => void;
  nameOf: (id: string) => string;
  className?: string;
}) {
  const draft = match.draft;
  const drafting = draft && (phase === "ban" || phase === "pick" || phase === "play") ? phase : null;
  const editGame = editing === null ? undefined : match.games.find((g) => g.number === editing);
  const formFor = editGame?.number ?? (match.admin && drafting !== "ban" && drafting !== "pick" ? match.next : null);
  const winner = decided ? (match.gamesA! > match.gamesB! ? match.a : match.b) : null;
  const rows: Row[] =
    drafting && draft && !editGame
      ? draftRows(match, draft, drafting)
      : [
          { side: match.a, games: decided ? match.gamesA! : sum.gamesA, fainted: decided ? (match.faintedA ?? sum.faintedA) : sum.faintedA },
          { side: match.b, games: decided ? match.gamesB! : sum.gamesB, fainted: decided ? (match.faintedB ?? sum.faintedB) : sum.faintedB },
        ].map(({ side, games, fainted }) => {
          const won = winner?.id === side.id;
          return {
            id: side.id,
            name: side.name,
            state: t.sideState(games, fainted),
            ink: won ? "text-yellow" : "text-muted-foreground",
            line: won ? "border-trophy-rim" : "border-border",
            icon: won ? "check" : null,
            sprite: null,
          };
        });
  const title =
    drafting && draft && !editGame
      ? drafting === "ban"
        ? t.bansTitle(draft.number)
        : drafting === "pick"
          ? mine && !draft[mine].picked
            ? t.yourSix(draft.number)
            : t.pickingSix(draft.number)
          : t.playTitle(draft.number)
      : decided || match.next === null
        ? t.result
        : t.game(match.next);
  const other = mine ? match[otherSide(mine)] : null;
  return (
    <section
      aria-labelledby="result-title"
      className={cn(
        "flex flex-col gap-3.5 rounded-[18px] border-3 bg-card p-4 sm:gap-4 sm:px-5.5 sm:pt-5 sm:pb-5.5",
        editGame || (drafting === "play" && match.admin) ? "border-primary" : decided ? "border-trophy-rim" : "border-border",
        className,
      )}
    >
      <h2 id="result-title" className="m-0 font-heading text-[1.75rem] leading-none font-normal sm:text-[2.125rem]">
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className={cn("flex min-h-13 items-center gap-3 rounded-xl border-3 bg-box px-3 sm:min-h-14 sm:px-3.5", row.line)}>
            <PlayerBadge name={row.name} colour={playerColour(row.name)} size="xs" />
            <span className="font-heading text-2xl">{row.name}</span>
            <span className="flex-1" />
            {row.sprite && <img src={row.sprite} alt="" className="-my-1.5 size-11 [image-rendering:pixelated]" />}
            <span className={cn("flex items-center gap-2 font-heading text-[1.375rem]", row.ink)}>
              {row.icon === "check" && <Check />}
              {row.icon === "wait" && <PixelIcon name="wait" className="size-4 motion-safe:animate-wait-blink" />}
              {row.state}
            </span>
          </div>
        ))}
      </div>
      {drafting === "ban" && draft && mine && other && !editGame && (
        <BanBox key={draft.number} match={match} draft={draft} mine={mine} choice={banChoice} other={other.name} onMoved={onMoved} />
      )}
      {drafting === "pick" && draft && mine && other && !editGame && (
        <PickBox key={draft.number} match={match} draft={draft} mine={mine} six={sixChoice} other={other.name} onMoved={onMoved} />
      )}
      {drafting === "play" && draft && !editGame && <PlayBox draft={draft} team={mine ? match.teams[mine] : null} picks={mine ? draft[mine].picks : null} />}
      {formFor !== null && formFor !== undefined ? (
        <GameForm key={`${formFor}-${editGame ? "edit" : "new"}`} match={match} number={formFor} game={editGame} onCancel={editGame ? onCancel : undefined} onSaved={onSaved} nameOf={nameOf} />
      ) : (
        winner &&
        !drafting && (
          <div className="mt-auto flex items-center gap-4 rounded-[14px] border-3 border-trophy-rim bg-trophy px-4.5 py-4">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-10 flex-none fill-yellow">
              <path d="M7 3h10v5a5 5 0 0 1-10 0z" />
              <path d="M10 13h4v4h3v4H7v-4h3z" />
            </svg>
            <span className="flex flex-col leading-[1.1]">
              <span className="font-heading text-3xl text-yellow">{t.wins(winner.name, Math.max(match.gamesA!, match.gamesB!), Math.min(match.gamesA!, match.gamesB!))}</span>
              <span className="font-heading text-xl text-subtle">{afterWin(match)}</span>
            </span>
          </div>
        )
      )}
    </section>
  );
}

function draftPath(match: MatchPage, number: number, step: "ban" | "pick"): string {
  return `/series/${match.number}/league/matches/${encodeURIComponent(match.id)}/games/${number}/${step}`;
}

function useMove(onMoved: (next: MatchPage) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      onMoved(await api(path, matchPage, { method: "POST", body }));
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  };
  return { busy, error, send };
}

function MoveError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="m-0 text-sm font-bold text-destructive">
      {error}
    </p>
  ) : null;
}

function BanBox({
  match,
  draft,
  mine,
  choice,
  other,
  onMoved,
}: {
  match: MatchPage;
  draft: GameDraft;
  mine: SideKey;
  choice: number | null;
  other: string;
  onMoved: (next: MatchPage) => void;
}) {
  const move = useMove(onMoved);
  const done = draft[mine].banned;
  const shown = done ? draft[mine].ban : choice;
  const team = match.teams[otherSide(mine)];
  const name = memberName(team, shown);
  const sprite = memberSprite(team, shown);
  const ready = !done && choice !== null && !move.busy;
  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className={cn("flex min-h-23 items-center gap-3.5 rounded-[14px] border-3 border-dashed bg-box px-4 py-2", name ? "border-destructive" : "border-cell-hi")}>
        {sprite && <img src={sprite} alt="" className="size-18 [image-rendering:pixelated]" />}
        <span className="flex flex-col leading-[1.1]">
          <span className="font-heading text-xl text-muted-foreground">{t.yourBan}</span>
          <span className={cn("font-heading text-3xl", name ? "text-coral" : "text-faint")}>{name ?? "—"}</span>
        </span>
      </div>
      <MoveError error={move.error} />
      <Button
        type="button"
        variant="go"
        disabled={!ready}
        onClick={() => void move.send(draftPath(match, draft.number, "ban"), { player: match[mine].id, slot: choice })}
        className="min-h-14 text-[1.75rem]"
      >
        {done ? t.waitingOn(other) : name ? t.banName(name) : t.ban}
      </Button>
    </div>
  );
}

function PickBox({
  match,
  draft,
  mine,
  six,
  other,
  onMoved,
}: {
  match: MatchPage;
  draft: GameDraft;
  mine: SideKey;
  six: number[];
  other: string;
  onMoved: (next: MatchPage) => void;
}) {
  const move = useMove(onMoved);
  const done = draft[mine].picked;
  const count = done ? (draft[mine].picks?.length ?? CUP_BROUGHT) : six.length;
  const ready = !done && six.length === CUP_BROUGHT && !move.busy;
  return (
    <div className="mt-auto flex flex-col gap-3">
      <span role="status" className={cn("font-heading text-[1.625rem]", count === CUP_BROUGHT ? "text-green" : "text-warning")}>
        {t.picked(count, CUP_BROUGHT)}
      </span>
      <MoveError error={move.error} />
      <Button
        type="button"
        variant="go"
        disabled={!ready}
        onClick={() => void move.send(draftPath(match, draft.number, "pick"), { player: match[mine].id, slots: six })}
        className="min-h-14 text-[1.75rem]"
      >
        {done ? t.waitingOn(other) : t.confirmSix}
      </Button>
    </div>
  );
}

function PlayBox({ draft, team, picks }: { draft: GameDraft; team: MatchTeam | null; picks: number[] | null }) {
  return (
    <div className="mt-auto flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-xl border-3 bg-box px-4 py-3">
        <span className="font-heading text-xl text-muted-foreground">{t.onShowdown}</span>
        <span className="font-heading text-2xl">{SHOWDOWN_FORMAT}</span>
        <span className="text-sm font-bold text-subtle">{t.clauses(SHOWDOWN_CLAUSES)}</span>
      </div>
      {team?.state === "shown" && picks && <CopySix key={`${draft.number}:${team.id}`} teamId={team.id} picks={picks} />}
    </div>
  );
}

function CopySix({ teamId, picks }: { teamId: string; picks: number[] }) {
  const [text, setText] = useState<string | null>(null);
  const six = picks.join(",");
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);

  useEffect(() => {
    let live = true;
    api(`/teams/${encodeURIComponent(teamId)}`, teamPage).then(
      (page) => {
        const stocks = new Map(page.sources.map((source) => [source.id, stockOf(source)]));
        const at = six.split(",").map(Number);
        if (live) setText(showdownTeam(analysedSlots(liveSlots(page.slots, stocks), at), stocks));
      },
      () => live && setCopied("failed"),
    );
    return () => {
      live = false;
    };
  }, [teamId, six]);

  useEffect(() => {
    if (copied !== "copied") return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      disabled={!text}
      onClick={() =>
        text &&
        navigator.clipboard.writeText(text).then(
          () => setCopied("copied"),
          () => setCopied("failed"),
        )
      }
      className="min-h-14 text-[1.625rem]"
    >
      <svg viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" className="size-4 fill-primary">
        <path d="M3 0h7v7H8V2H3zM0 3h7v7H0z" />
      </svg>
      {copied === "copied" ? t.copied : copied === "failed" ? t.copyFailed : t.copySix}
    </Button>
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
