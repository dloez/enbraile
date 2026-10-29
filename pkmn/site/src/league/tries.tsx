import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";
import { LEAGUE_COMBATS, type LeaguePage, type LeagueTry } from "../../shared/league";

const TryDialog = lazy(() => import("@/league/try-dialog").then((m) => ({ default: m.TryDialog })));

const t = messages({
  en: {
    log: "Log a try",
    of: (n: number) => `${n} of ${LEAGUE_COMBATS}`,
    combats: (n: number) => `${n} of ${LEAGUE_COMBATS} combats won`,
    none: "No tries",
    count: (n: number) => (n === 1 ? "1 try" : `${n} tries`),
    open: (name: string) => `Open ${name}'s tries`,
    close: (name: string) => `Close ${name}'s tries`,
    title: (n: number) => `Try ${n}`,
    best: "Best",
    fellIn: (name: string, combat: number) => `${name}, fell in combat ${combat}`,
    team: "Team",
    edit: "Edit",
    editLabel: (name: string, n: number) => `Edit ${name}'s try ${n}`,
    tries: "Pokémon League tries",
    heldYou: "Its Pokémon show once you reach the Pokémon League",
    heldAll: "Its Pokémon show once every player reaches the Pokémon League",
  },
  es: {
    log: "Anotar un intento",
    of: (n: number) => `${n} de ${LEAGUE_COMBATS}`,
    combats: (n: number) => `${n} de ${LEAGUE_COMBATS} combates ganados`,
    none: "Sin intentos",
    count: (n: number) => (n === 1 ? "1 intento" : `${n} intentos`),
    open: (name: string) => `Abrir los intentos de ${name}`,
    close: (name: string) => `Cerrar los intentos de ${name}`,
    title: (n: number) => `Intento ${n}`,
    best: "Mejor",
    fellIn: (name: string, combat: number) => `${name}, cayó en el combate ${combat}`,
    team: "Equipo",
    edit: "Editar",
    editLabel: (name: string, n: number) => `Editar el intento ${n} de ${name}`,
    tries: "Intentos de la Liga Pokémon",
    heldYou: "Sus Pokémon se ven cuando llegues a la Liga Pokémon",
    heldAll: "Sus Pokémon se ven cuando todos los jugadores lleguen a la Liga Pokémon",
  },
});

export function combatsLabel(best: number | null): string {
  return best === null ? t.none : t.combats(best);
}

export function Pips({ won, size = "md" }: { won: number; size?: "sm" | "md" | "lg" }) {
  return (
    <span aria-hidden="true" className={cn("flex", size === "sm" ? "gap-0.75" : size === "md" ? "gap-1" : "gap-1.5")}>
      {Array.from({ length: LEAGUE_COMBATS }, (_, at) => (
        <span
          key={at}
          className={cn(
            "box-border",
            size === "sm" ? "size-3.5 rounded-sm border-2" : size === "md" ? "size-4.5 rounded-[5px] border-3" : "size-6.5 rounded-[7px] border-3",
            at < won ? cn("border-ink", at === LEAGUE_COMBATS - 1 ? "bg-yellow" : "bg-cyan") : "border-cell-hi bg-ink",
          )}
        />
      ))}
    </span>
  );
}

type Editing = { mode: "log" } | { mode: "edit"; one: LeagueTry };

export function Tries({ league, me, nameOf, onChange }: { league: LeaguePage; me: string | null; nameOf: (id: string) => string; onChange: (page: LeaguePage) => void }) {
  const [open, setOpen] = useState<string | null>(me);
  const [editing, setEditing] = useState<Editing | null>(null);
  const canLog = me !== null && !league.admin;
  const order = league.standings.map((row) => row.player);
  const held = league.enrolled ? t.heldYou : t.heldAll;
  return (
    <>
      {canLog && (
        <div className="flex">
          <Button variant="go" onClick={() => setEditing({ mode: "log" })} className="w-full pb-1 text-[1.5625rem] sm:ml-auto sm:min-h-13 sm:w-auto sm:px-5 sm:text-[1.625rem]">
            <Plus className="size-3.5" strokeWidth={4} />
            {t.log}
          </Button>
        </div>
      )}
      <section aria-label={t.tries} className="overflow-hidden rounded-[18px] border-3 bg-card">
        {order.map((player, index) => {
          const name = nameOf(player);
          const tries = league.tries.filter((one) => one.player === player);
          const best = tries.find((one) => one.best) ?? null;
          const shown = open === player && tries.length > 0;
          return (
            <div key={player} className={cn(index < order.length - 1 && "border-b-3")}>
              <div className={cn("flex min-h-17 items-center gap-2.5 py-1.5 pr-2.5 pl-3 sm:min-h-21 sm:gap-4 sm:px-5", player === me && "bg-yellow/6")}>
                <PlayerBadge name={name} colour={playerColour(name)} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.05] sm:flex-row sm:items-center sm:gap-4">
                  <span className="truncate font-heading text-[1.5625rem] sm:w-42.5 sm:flex-none sm:text-3xl">{name}</span>
                  <span className="flex items-center gap-2 sm:gap-4">
                    <span className="sm:hidden">
                      <Pips won={best?.combatsWon ?? 0} size="sm" />
                    </span>
                    <span className="hidden sm:block">
                      <Pips won={best?.combatsWon ?? 0} size="lg" />
                    </span>
                    <span className={cn("font-heading text-lg sm:text-[1.625rem]", best ? "text-white" : "text-faint")}>{best ? t.of(best.combatsWon) : t.none}</span>
                  </span>
                </span>
                <span className="font-heading text-lg whitespace-nowrap text-muted-foreground sm:text-[1.375rem]">{t.count(tries.length)}</span>
                {tries.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={shown}
                    aria-label={shown ? t.close(name) : t.open(name)}
                    onClick={() => setOpen(shown ? null : player)}
                    className="grid size-11 flex-none cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <svg width="16" height="12" viewBox="0 0 22 16" aria-hidden="true" className={cn("fill-primary", shown && "rotate-180")}>
                      <path d="M2 3h18l-9 11z" />
                    </svg>
                  </button>
                )}
              </div>
              {shown && (
                <div className="flex flex-col gap-2 border-t-3 border-dashed bg-box p-2.5 pb-3 sm:gap-2.5 sm:py-3.5 sm:pr-5 sm:pb-5 sm:pl-20.5">
                  {tries.map((one) => (
                    <TryCard
                      key={one.id}
                      one={one}
                      name={name}
                      held={held}
                      canEdit={league.admin || one.player === me}
                      onEdit={() => setEditing({ mode: "edit", one })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
      {editing && (
        <Suspense fallback={null}>
          <TryDialog
            number={league.number}
            editing={editing.mode === "edit" ? { one: editing.one, name: nameOf(editing.one.player) } : null}
            me={me}
            onClose={() => setEditing(null)}
            onSaved={(page) => {
              onChange(page);
              setEditing(null);
            }}
          />
        </Suspense>
      )}
    </>
  );
}

function TryCard({ one, name, held, canEdit, onEdit }: { one: LeagueTry; name: string; held: string; canEdit: boolean; onEdit: () => void }) {
  const actions = (
    <>
      {one.team && (
        <Link
          to="/teams/$id"
          params={{ id: one.team }}
          className="flex min-h-11 items-center font-heading text-[1.1875rem] text-primary no-underline outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-xl"
        >
          {t.team}
        </Link>
      )}
      {canEdit && (
        <Button aria-label={t.editLabel(name, one.number)} onClick={onEdit} className="min-h-9 px-2.5 text-lg sm:min-h-10 sm:px-3.5 sm:text-xl">
          {t.edit}
        </Button>
      )}
    </>
  );
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border-3 bg-card p-2.5 pb-3 sm:flex-row sm:items-center sm:gap-4.5 sm:px-3.5 sm:py-2.5", one.best ? "border-mult-2" : "border-border")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:contents">
        <span className="flex items-baseline gap-2.5 leading-[1.1] sm:w-23 sm:flex-none sm:flex-col sm:gap-0">
          <span className="font-heading text-[1.4375rem] sm:text-2xl">{t.title(one.number)}</span>
          {one.best && <span className="font-heading text-base text-green sm:font-sans sm:text-[0.8125rem] sm:font-bold">{t.best}</span>}
        </span>
        <span className="sm:hidden">
          <Pips won={one.combatsWon} size="sm" />
        </span>
        <span className="hidden sm:block">
          <Pips won={one.combatsWon} size="md" />
        </span>
        <span className="sr-only">{t.combats(one.combatsWon)}</span>
        <span className="flex-1 sm:hidden" />
        <span className="flex items-center gap-2.5 sm:hidden">{actions}</span>
      </div>
      {one.members === null ? (
        <p className="m-0 flex min-h-12.5 items-center rounded-lg border-2 border-dashed bg-box px-3 py-1.5 font-heading leading-[1.15] text-lg text-subtle sm:min-h-15 sm:rounded-[10px] sm:text-xl">{held}</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0 sm:flex">
          {one.members.map((member, at) => (
            <li
              key={at}
              className="relative flex h-12.5 items-center justify-center overflow-hidden rounded-lg border-2 bg-box sm:h-15 sm:w-17 sm:rounded-[10px]"
            >
              {member.sprite ? (
                <img
                  src={member.sprite}
                  alt={member.fell ? t.fellIn(member.name, member.fell) : member.name}
                  width={68}
                  height={68}
                  className={cn("block size-full object-contain [image-rendering:pixelated]", member.fell && "opacity-45 grayscale")}
                />
              ) : (
                <span className="px-1 text-center text-xs font-bold text-muted-foreground">{member.fell ? t.fellIn(member.name, member.fell) : member.name}</span>
              )}
              {member.fell && (
                <span aria-hidden="true" className="absolute right-0.5 bottom-0.5 h-4.25 min-w-4.25 rounded-sm bg-red px-0.75 text-center font-heading text-sm leading-4.25 text-white sm:right-0.75 sm:bottom-0.75 sm:h-5 sm:min-w-5 sm:rounded-[5px] sm:px-1 sm:text-base sm:leading-5">
                  {member.fell}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <span className="hidden flex-1 sm:block" />
      <span className="hidden items-center gap-3.5 sm:flex">{actions}</span>
    </div>
  );
}
