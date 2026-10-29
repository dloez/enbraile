import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { segButton, segTrack } from "@/teams/components/editors";
import { EVERY_SPECIES, readShowdownTeam } from "@/teams/showdown";
import { messages } from "../../shared/i18n";
import { LEAGUE_COMBATS, lastCombat, leaguePage, type LeaguePage, type LeagueTry, PARTY_SIZE } from "../../shared/league";
import { describeMember } from "../../shared/species";
import { teamList, type TeamRow } from "../../shared/team";

const t = messages({
  en: {
    failed: "Something went wrong",
    logTitle: "Log a Pokémon League try",
    logShort: "Log a try",
    editTitle: (name: string, n: number) => `${name}'s try ${n}`,
    close: "Close",
    theTeam: "The team",
    teamFrom: "Team from",
    yours: "Your teams",
    paste: "Paste",
    pasteLabel: "Showdown paste",
    loading: "Loading your teams…",
    noTeams: `No team of 1 to ${PARTY_SIZE} Pokémon yet: paste one instead`,
    read: (n: number) => (n === 1 ? "1 Pokémon read, as a new Any Pokémon team" : `${n} Pokémon read, as a new Any Pokémon team`),
    tooMany: `A Pokémon League team brings at most ${PARTY_SIZE}`,
    leftOut: "Left out:",
    won: "Combats won",
    caps: ["None", "Elite 1", "Elite 2", "Elite 3", "Elite 4", "Rival"],
    fell: "Where each one fell",
    whereFell: (name: string) => `Where ${name} fell`,
    stood: "Stood",
    fellIn: (n: number) => `Fell in ${n}`,
    beat: "Beat the League",
    stopped: (at: string, n: number) => `Stopped at ${at} · ${n} fell`,
    cancel: "Cancel",
    save: "Save the try",
    saveEdit: "Save",
    remove: "Delete",
    sure: "Delete this try?",
    keep: "Keep it",
  },
  es: {
    failed: "Algo ha fallado",
    logTitle: "Anotar un intento de la Liga Pokémon",
    logShort: "Anotar un intento",
    editTitle: (name: string, n: number) => `Intento ${n} de ${name}`,
    close: "Cerrar",
    theTeam: "El equipo",
    teamFrom: "Equipo de",
    yours: "Tus equipos",
    paste: "Pegar",
    pasteLabel: "Equipo de Showdown",
    loading: "Cargando tus equipos…",
    noTeams: `Aún no tienes un equipo de 1 a ${PARTY_SIZE} Pokémon: pega uno`,
    read: (n: number) => (n === 1 ? "1 Pokémon leído, como un equipo nuevo de Cualquier Pokémon" : `${n} Pokémon leídos, como un equipo nuevo de Cualquier Pokémon`),
    tooMany: `Un equipo de la Liga Pokémon lleva como mucho ${PARTY_SIZE}`,
    leftOut: "Se han quedado fuera:",
    won: "Combates ganados",
    caps: ["Ninguno", "Élite 1", "Élite 2", "Élite 3", "Élite 4", "Rival"],
    fell: "Dónde cayó cada uno",
    whereFell: (name: string) => `Dónde cayó ${name}`,
    stood: "En pie",
    fellIn: (n: number) => `Cayó en ${n}`,
    beat: "Ganó la Liga",
    stopped: (at: string, n: number) => `Se quedó en ${at} · ${n} cayeron`,
    cancel: "Cancelar",
    save: "Guardar el intento",
    saveEdit: "Guardar",
    remove: "Borrar",
    sure: "¿Borrar este intento?",
    keep: "Conservarlo",
  },
});

const EMPTY = new Map();

type Shown = { name: string; sprite: string | null };

const shown = (species: string): Shown => describeMember(species, species);

const brought = (row: TeamRow) => row.members.filter((species): species is string => species !== null);

export function TryDialog({
  number,
  editing,
  me,
  onClose,
  onSaved,
}: {
  number: number;
  editing: { one: LeagueTry; name: string } | null;
  me: string | null;
  onClose: () => void;
  onSaved: (page: LeaguePage) => void;
}) {
  const one = editing?.one ?? null;
  const [from, setFrom] = useState<"pick" | "paste">("pick");
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [won, setWon] = useState(one?.combatsWon ?? 0);
  const [fell, setFell] = useState<(number | null)[]>(one?.members.map((m) => m.fell) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (one || !me) return;
    api(`/teams?owner=${encodeURIComponent(me)}`, teamList).then(
      (rows) => {
        const usable = rows.filter((row) => row.league?.kind !== "cup" && row.league?.kind !== "round" && brought(row).length > 0 && brought(row).length <= PARTY_SIZE);
        setTeams(usable);
        setPicked(usable[0]?.id ?? null);
        if (usable.length === 0) setFrom("paste");
      },
      (caught: unknown) => setError(caught instanceof Error ? caught.message : t.failed),
    );
  }, [one, me]);

  const read = useMemo(() => (from === "paste" && !one ? readShowdownTeam(text, EMPTY, EVERY_SPECIES) : null), [from, text, one]);

  const members: Shown[] = useMemo(() => {
    if (one) return one.members.map((m) => ({ name: m.name, sprite: m.sprite }));
    if (read) return read.slots.flatMap((member) => (member ? [shown(member.species)] : []));
    const row = teams?.find((r) => r.id === picked);
    return row ? brought(row).map(shown) : [];
  }, [one, read, teams, picked]);

  const memberKey = members.map((m) => m.name).join("|");
  useEffect(() => {
    if (one) return;
    setFell(members.map(() => null));
  }, [memberKey]);

  const last = lastCombat(won);
  const out = fell.filter((combat) => combat !== null).length;
  const tooMany = read !== null && read.added > PARTY_SIZE;
  const ready = !busy && members.length > 0 && members.length <= PARTY_SIZE && fell.length === members.length && !tooMany;

  function chooseWon(n: number) {
    setWon(n);
    setFell((now) => now.map((combat) => (combat !== null && combat > lastCombat(n) ? null : combat)));
  }

  async function send(run: () => Promise<LeaguePage>) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await run());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.failed);
      setBusy(false);
    }
  }

  function save() {
    const path = `/series/${number}/league/tries`;
    if (one) {
      void send(() => api(`${path}/${encodeURIComponent(one.id)}`, leaguePage, { method: "PUT", body: { combatsWon: won, fell } }));
      return;
    }
    const team = read ? { slots: read.slots } : picked ? { id: picked } : null;
    if (!team) return;
    void send(() => api(path, leaguePage, { body: { combatsWon: won, fell, team } }));
  }

  function remove() {
    if (!one) return;
    void send(() => api(`/series/${number}/league/tries/${encodeURIComponent(one.id)}`, leaguePage, { method: "DELETE" }));
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className={cn(
          "flex max-h-[90svh] flex-col gap-4.5 overflow-y-auto border-3 border-cell-hi bg-box px-4 pt-4.5 pb-6 text-base ring-0 sm:max-w-195 sm:px-6.5 sm:pt-5.5",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-b-0",
        )}
      >
        <div className="flex items-center gap-3">
          <DialogTitle className="m-0 min-w-0 flex-1 font-heading text-3xl leading-none font-normal sm:text-4xl">
            {editing ? (
              t.editTitle(editing.name, editing.one.number)
            ) : (
              <>
                <span className="sm:hidden">{t.logShort}</span>
                <span className="hidden sm:inline">{t.logTitle}</span>
              </>
            )}
          </DialogTitle>
          <button
            type="button"
            aria-label={t.close}
            title={t.close}
            disabled={busy}
            onClick={onClose}
            className="grid size-11 flex-none cursor-pointer place-items-center rounded-lg text-muted-foreground outline-none hover:bg-cell hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {!one && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <span className="font-heading text-[1.3125rem] text-subtle sm:text-[1.375rem]">{t.theTeam}</span>
              <span className="flex-1 sm:hidden" />
              <div role="radiogroup" aria-label={t.teamFrom} className={segTrack}>
                {(
                  [
                    ["pick", t.yours],
                    ["paste", t.paste],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} type="button" role="radio" aria-checked={from === value} onClick={() => setFrom(value)} className={cn(segButton(from === value), "min-h-9.5 sm:min-h-10 sm:px-4")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {from === "pick" &&
              (teams === null ? (
                <p className="m-0 font-heading text-xl text-faint">{t.loading}</p>
              ) : teams.length === 0 ? (
                <p className="m-0 font-heading text-xl text-faint">{t.noTeams}</p>
              ) : (
                <div role="radiogroup" aria-label={t.yours} className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                  {teams.map((row) => {
                    const on = row.id === picked;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPicked(row.id)}
                        className={cn(
                          "flex cursor-pointer flex-col gap-1 rounded-xl border-3 px-2.5 py-2 text-left text-foreground outline-none hover:border-primary hover:bg-row-hi focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-16 sm:flex-row sm:items-center sm:gap-3.5 sm:px-3.5 sm:py-0",
                          on ? "border-primary bg-row-hi" : "border-border bg-card",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5 sm:flex-1 sm:gap-3.5">
                          <span aria-hidden="true" className={cn("size-5.5 flex-none rounded-full border-3", on ? "border-ink bg-primary" : "border-cell-hi")} />
                          <span className="truncate font-heading text-[1.375rem] sm:text-2xl">{row.name}</span>
                        </span>
                        <span className="grid grid-cols-6 sm:flex sm:flex-none sm:gap-0.5">
                          {brought(row).map((species, at) => {
                            const look = shown(species);
                            return look.sprite ? (
                              <img key={at} src={look.sprite} alt={look.name} width={52} height={52} className="-my-1 block size-12 justify-self-center [image-rendering:pixelated] sm:size-13" />
                            ) : (
                              <span key={at} className="text-xs font-bold text-muted-foreground">
                                {look.name}
                              </span>
                            );
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            {from === "paste" && (
              <>
                <textarea
                  autoFocus
                  aria-label={t.pasteLabel}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={"Metagross @ Life Orb\nAbility: Clear Body\n- Meteor Mash\n..."}
                  className="resize-none rounded-xl border-3 bg-ink px-3 py-3 font-sans text-[0.9375rem] leading-[1.4] font-semibold text-foreground outline-none placeholder:text-faint focus-visible:border-primary sm:px-3.5"
                />
                {read && read.added > 0 && <p className={cn("m-0 text-sm font-bold", tooMany ? "text-destructive" : "text-muted-foreground")}>{tooMany ? t.tooMany : t.read(read.added)}</p>}
                {read && read.left.length > 0 && (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="m-0 font-bold">{t.leftOut}</p>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-destructive">
                      {read.left.map((line, at) => (
                        <li key={at}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <span id="try-won" className="font-heading text-[1.3125rem] text-subtle sm:text-[1.375rem]">
            {t.won}
          </span>
          <div role="radiogroup" aria-labelledby="try-won" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {Array.from({ length: LEAGUE_COMBATS + 1 }, (_, n) => {
              const on = n === won;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => chooseWon(n)}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[10px] border-3 font-heading leading-[1.05] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-14.5 sm:flex-col sm:gap-0",
                    on ? cn("border-ink text-ink", n === LEAGUE_COMBATS ? "bg-yellow" : "bg-cyan") : "border-border bg-card text-subtle hover:bg-cell hover:text-white",
                  )}
                >
                  <span className="text-[1.625rem] sm:text-[1.75rem]">{n}</span>
                  <span className="text-[0.9375rem] opacity-80">{t.caps[n]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {members.length > 0 && !tooMany && (
          <div className="flex flex-col gap-2.5">
            <span className="font-heading text-[1.3125rem] text-subtle sm:text-[1.375rem]">{t.fell}</span>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {members.map((member, at) => {
                const combat = fell[at] ?? null;
                return (
                  <div key={at} className={cn("flex flex-col items-center gap-1 rounded-xl border-3 bg-card px-1.5 pt-1.5 pb-2", combat ? "border-coral/40" : "border-border")}>
                    {member.sprite ? (
                      <img src={member.sprite} alt="" width={64} height={64} className={cn("-mt-1.5 -mb-1 block size-15 [image-rendering:pixelated] sm:size-16", combat && "opacity-50 grayscale")} />
                    ) : (
                      <span className="grid h-15 place-items-center text-center text-xs font-bold text-muted-foreground">{member.name}</span>
                    )}
                    <select
                      aria-label={t.whereFell(member.name)}
                      value={combat ?? 0}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setFell((now) => now.map((c, i) => (i === at ? (value > 0 ? value : null) : c)));
                      }}
                      className={cn(
                        "min-h-9 w-full cursor-pointer rounded-lg border-2 border-cell-hi bg-ink text-center font-heading text-lg outline-none focus-visible:border-primary",
                        combat ? "text-coral" : "text-green",
                      )}
                    >
                      <option value={0}>{t.stood}</option>
                      {Array.from({ length: last }, (_, i) => i + 1).map((c) => (
                        <option key={c} value={c}>
                          {t.fellIn(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="m-0 text-sm font-bold text-destructive">
            {error}
          </p>
        )}

        {deleting ? (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="font-heading text-xl text-destructive">{t.sure}</span>
            <span className="flex-1" />
            <Button disabled={busy} onClick={() => setDeleting(false)} className="min-h-13 px-4.5">
              {t.keep}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={remove} className="min-h-13 px-4.5">
              {t.remove}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
            <span className="font-heading text-[1.1875rem] text-muted-foreground sm:font-sans sm:text-sm sm:font-bold">
              {won === LEAGUE_COMBATS ? t.beat : t.stopped(t.caps[won + 1] ?? "", out)}
            </span>
            <span className="hidden flex-1 sm:block" />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 sm:flex sm:gap-3">
              {one ? (
                <Button variant="destructive" disabled={busy} onClick={() => setDeleting(true)} className="min-h-13 px-4.5">
                  {t.remove}
                </Button>
              ) : (
                <Button disabled={busy} onClick={onClose} className="min-h-13 px-4.5">
                  {t.cancel}
                </Button>
              )}
              <Button variant="go" disabled={!ready} onClick={save} className="min-h-13 px-5.5">
                {one ? t.saveEdit : t.save}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
