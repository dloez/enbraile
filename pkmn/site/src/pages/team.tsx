import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ClipboardCheck, ClipboardCopy, CopyPlus, Lock, Plus, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toolPage } from "@/components/page";
import { MiniSeta } from "@/components/pc/bag";
import { SummaryBody, SummaryHead } from "@/components/pc/summary";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PLAYER_FILL, playerColour } from "@/components/player-badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { setAt } from "@/lib/admin-format";
import { recountTeamsToBuild } from "@/lib/teams-to-build";
import { GameIconsProvider } from "@/lib/item-icons";
import { cn } from "@/lib/utils";
import { TeamFrame, TeamsBackLink } from "@/components/page-frames";
import { AddDialog, type AddSource } from "@/teams/components/add-dialog";
import { SetEditor } from "@/teams/components/free-member";
import { AbilityEditor, ItemEditor, NatureEditor, segButton, segTrack } from "@/teams/components/editors";
import { EmptyCard, MemberCard, type Focus } from "@/teams/components/member-card";
import { MoveEditor } from "@/teams/components/move-picker";
import { PasteDialog } from "@/teams/components/paste-dialog";
import { AnyMark, SnapshotMenu, sourceLabel } from "@/teams/components/snapshot-menu";
import { preloadGraph, SheetAnalysis } from "@/teams/components/sheet-analysis";
import { allowedMoves, currentAbility, type Mon } from "../../shared/mon";
import { defensesOf, describeMove, describeTm } from "../../shared/describe";
import { liveSlots, memberMon } from "@/teams/dex";
import { EMPTY_SHEET, formatMoney, freeCount, giveItem, isFree, lastFilled, moneyLeft, natureFrom, ownOf, putFree, putMember, removeMember, resized, setAbility, setasLeft, setFree, setMove, setNature, spreadShown, stockOf, takeItem, usedBy, PICK_SIZE, TEAM_SIZE, TEAM_SIZES, type Member, type Slots, type Stock, type Stocks } from "@/teams/team";
import { analysedSlots, filledAt, loadPick, pickedOf, savePick, togglePicked, type Pick, type Scope } from "@/teams/pick";
import { ANY_POKEMON, showdownTeam } from "@/teams/showdown";
import { hasToggle, teamDone, teamKind, teamMade, teamPage, teamName, type TeamPage, type TeamSource, type TeamSourceRow } from "../../shared/team";
import { PixelIcon } from "@/components/pixel-icon";
import { cupStage } from "@/league/cup";
import { speciesTags } from "../../shared/dex";
import { lockNeeds } from "../../shared/league";
import { MOVE_RULE_LABELS, MOVE_RULES, type FreePool, type MoveRule, type TeamPool } from "../../shared/pool";
import { SelectField } from "@/components/select-field";
import { messages } from "../../shared/i18n";

const t = messages({
  en: {
    failed: "Something went wrong",
    deleted: "This team's snapshot was deleted",
    backSummary: "Back to the summary",
    backAnalysis: "Back to the analysis",
    members: "Members",
    analysis: "Analysis",
    summary: "Summary",
    editor: "Editor",
    ownerTeam: (owner: string) => `${owner}'s team`,
    onlyOwner: (owner: string) => `Only ${owner} can change this team`,
    viewOnly: "View only",
    paste: "Paste",
    notSaved: (reason: string) => `Not saved: ${reason}`,
    teamView: "Team view",
    close: "Close",
    setasLeft: "Mini Setas left",
    noMoney: "No money in this snapshot",
    moneyLeft: "Money left for mints",
    remove: (label: string) => `Remove ${label}`,
    removeSource: "Remove this source",
    any: "Any Pokémon",
    removeAny: "Remove Any Pokémon",
    source: "Source",
    sources: (n: number) => `${n} sources`,
    overspent: "A source has spent more than it has",
    addSource: "Add a source",
    memberCount: (n: number) => `${n} members`,
    seenBy: "Seen by",
    private: "Private",
    public: "Public",
    privateTitle: "Only you and admins see it",
    publicTitle: "Every player sees it",
    moves: "Moves",
    analyse: "Analyse",
    all: (n: number) => `All ${n}`,
    pickN: (n: number) => `Pick ${n}`,
    pickedOf: (picked: number, of: number) => `${picked} of ${of} in`,
    rename: "Rename the team",
    teamName: "Team name",
    copied: "Copied",
    copyFailed: "Copy failed",
    copy: "Copy for Showdown",
    delete: "Delete",
    deleteName: (name: string) => `Delete ${name}?`,
    cancel: "Cancel",
    locked: "Locked",
    lockedTo: (to: string) => `Locked · ${to}`,
    lockIn: "Lock in",
    lockName: (name: string) => `Lock in ${name}?`,
    lockNote: "Once locked, nothing in it can change; only an admin can unlock it.",
    fillFirst: (need: number, size: number) => (need === size ? `Fill all ${size} slots to lock it in` : `Fill ${need} slots to lock it in`),
    round: (n: number) => `Round ${n}`,
    unlock: "Unlock",
    clone: "Clone",
    cloneTitle: "Copy it into a new team of yours to edit",
    fixedBy: (by: string | null, at: string) => (by ? `Fixed by ${by} · ${at}` : `Fixed · ${at}`),
    fixTitle: "An admin's change to its members while it stays locked",
    fixing: "Your changes to its members fix it in place; it stays locked",
  },
  es: {
    failed: "Algo ha fallado",
    deleted: "La captura de este equipo se borró",
    backSummary: "Volver al resumen",
    backAnalysis: "Volver al análisis",
    members: "Miembros",
    analysis: "Análisis",
    summary: "Resumen",
    editor: "Editor",
    ownerTeam: (owner: string) => `Equipo de ${owner}`,
    onlyOwner: (owner: string) => `Solo ${owner} puede cambiar este equipo`,
    viewOnly: "Solo lectura",
    paste: "Pegar",
    notSaved: (reason: string) => `No se ha guardado: ${reason}`,
    teamView: "Vista del equipo",
    close: "Cerrar",
    setasLeft: "Mini Setas restantes",
    noMoney: "No hay dinero en esta captura",
    moneyLeft: "Dinero restante para mentas",
    remove: (label: string) => `Quitar ${label}`,
    removeSource: "Quitar esta fuente",
    any: "Cualquier Pokémon",
    removeAny: "Quitar Cualquier Pokémon",
    source: "Fuente",
    sources: (n: number) => `${n} fuentes`,
    overspent: "Una fuente ha gastado más de lo que tiene",
    addSource: "Añadir una fuente",
    memberCount: (n: number) => `${n} miembros`,
    seenBy: "Lo ve",
    private: "Privado",
    public: "Público",
    privateTitle: "Solo tú y los administradores lo veis",
    publicTitle: "Lo ven todos los jugadores",
    moves: "Movimientos",
    analyse: "Analizar",
    all: (n: number) => `Los ${n}`,
    pickN: (n: number) => `Elegir ${n}`,
    pickedOf: (picked: number, of: number) => `${picked} de ${of} dentro`,
    rename: "Renombrar el equipo",
    teamName: "Nombre del equipo",
    copied: "Copiado",
    copyFailed: "No se pudo copiar",
    copy: "Copiar para Showdown",
    delete: "Borrar",
    deleteName: (name: string) => `¿Borrar ${name}?`,
    cancel: "Cancelar",
    locked: "Bloqueado",
    lockedTo: (to: string) => `Bloqueado · ${to}`,
    lockIn: "Bloquear",
    lockName: (name: string) => `¿Bloquear ${name}?`,
    lockNote: "Una vez bloqueado no se puede cambiar nada; solo un administrador puede desbloquearlo.",
    fillFirst: (need: number, size: number) => (need === size ? `Llena los ${size} huecos para bloquearlo` : `Llena ${need} huecos para bloquearlo`),
    round: (n: number) => `Ronda ${n}`,
    unlock: "Desbloquear",
    clone: "Clonar",
    cloneTitle: "Cópialo en un equipo nuevo tuyo para editarlo",
    fixedBy: (by: string | null, at: string) => (by ? `Corregido por ${by} · ${at}` : `Corregido · ${at}`),
    fixTitle: "Un cambio de un administrador en sus miembros sin desbloquearlo",
    fixing: "Tus cambios en sus miembros lo corrigen tal cual; sigue bloqueado",
  },
});

const FROM = "/teams/$id";

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

type Back = "ana" | "sum";

type Panel =
  | { t: "ana" }
  | { t: "sum"; slot: number }
  | { t: "item"; slot: number; back: Back }
  | { t: "ability"; slot: number; back: Back }
  | { t: "nature"; slot: number; back: Back }
  | { t: "move"; slot: number; at: number; back: Back }
  | { t: "set"; slot: number; back: Back };

export function TeamBuilderPage() {
  const { id } = useParams({ from: FROM });
  const [page, setPage] = useState<TeamPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loads, setLoads] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    api(`/teams/${encodeURIComponent(id)}`, teamPage).then(
      (next) => live && setPage(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, [id, loads]);

  useEffect(() => setPage(null), [id]);

  if (error) {
    return (
      <main className={cn(toolPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!page) return <TeamFrame />;
  if (page.sources.length === 0 && !page.anyPokemon) {
    return (
      <main className={cn(toolPage, "gap-4 pt-5")}>
        <TeamsBackLink />
        <h1 className="m-0 font-heading text-5xl leading-[0.85] font-normal">{page.name}</h1>
        <p className="m-0 rounded-2xl border-3 border-dashed border-cell-hi bg-box px-5 py-10 text-center font-heading text-3xl text-subtle">
          {t.deleted}
        </p>
      </main>
    );
  }
  return (
    <GameIconsProvider game={page.sources.find((source) => source.gameId !== null)?.gameId ?? null}>
      <Builder key={`${page.id}:${page.lockedAt}`} page={page} onReload={() => setLoads((n) => n + 1)} />
    </GameIconsProvider>
  );
}

function asSet(mon: Mon, member: Member, rule: MoveRule): Mon {
  const ability = member.ability ?? currentAbility(mon);
  const abilities = mon.abilities.map((a) => ({ ...a, current: a.id === ability }));
  return {
    ...mon,
    abilities,
    defenses: defensesOf(mon.types, abilities),
    learnable: mon.learnable && { ...allowedMoves(mon, rule)!, current: member.moves.flatMap((m) => (m ? [describeMove(m)] : [])) },
  };
}

interface Held extends Stock, AddSource {
  source: TeamSource;
  owner: string;
  colour: number;
}

function holding(sources: readonly TeamSource[]): Held[] {
  return sources.map((source) => ({
    id: source.id,
    source,
    label: sourceLabel(source),
    series: source.series.number,
    owner: source.player.name,
    colour: playerColour(source.player.name),
    ...stockOf(source),
    tms: source.snapshot.tms.map(describeTm),
    gaps: source.missing?.missing ?? [],
  }));
}

function Builder({ page, onReload }: { page: TeamPage; onReload: () => void }) {
  const navigate = useNavigate();
  const wide = useMediaQuery("(min-width: 64rem)");
  const [sources, setSources] = useState<readonly TeamSource[]>(page.sources);
  const [anyPokemon, setAnyPokemon] = useState(page.anyPokemon);
  const [pool, setPool] = useState<TeamPool>(page.pool);
  const [freePool, setFreePool] = useState<FreePool>(page.freePool);
  const [hidden, setHidden] = useState(page.private);
  const movesGen = Math.min(pool.gen, pool.movesGen);
  const held = useMemo(() => holding(sources), [sources]);
  const stocks = useMemo(() => new Map(held.map((h) => [h.id, h])), [held]);
  const [name, setName] = useState(page.name);
  const [stored, setStored] = useState<Slots>(page.slots);
  const slots = useMemo(() => liveSlots(stored, stocks), [stored, stocks]);
  const [panel, setPanel] = useState<Panel>({ t: "ana" });
  const [adding, setAdding] = useState<number | null>(null);
  const [glow, setGlow] = useState<number | null>(null);
  const [tab, setTab] = useState<"members" | "analysis">("members");
  const [pasting, setPasting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick>(() => loadPick(page.id));
  const [joining, setJoining] = useState(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const editable = page.canEdit || page.canFix;
  const owned = page.canEdit;
  const fixed = page.league?.kind === "cup" || page.league?.kind === "round";
  const size = slots.length;
  const pickMode = size > TEAM_SIZE && pick.scope === "six";
  const picked = pickedOf(slots, pick);
  const analysed = pickMode ? analysedSlots(slots, picked) : slots;

  useEffect(preloadGraph, []);

  function choosePick(next: Pick) {
    setPick(next);
    savePick(page.id, next);
  }

  function write(body: { slots?: Slots; name?: string; sources?: string[]; anyPokemon?: boolean; pool?: TeamPool; freePool?: FreePool; private?: boolean }, after?: () => Promise<void>) {
    writes.current = writes.current
      .then(async () => {
        await api(`/teams/${encodeURIComponent(page.id)}`, teamDone, { method: "PUT", body });
        await after?.();
      })
      .then(
        () => {
          setFailed(null);
          if (page.canFix) onReload();
        },
        (caught: unknown) => setFailed(message(caught)),
      );
  }

  function removeSource(id: string) {
    const next = sources.filter((s) => s.id !== id);
    setSources(next);
    setStored(slots);
    write({ sources: next.map((s) => s.id), slots });
  }

  function chooseAny(next: boolean) {
    setAnyPokemon(next);
    setStored(slots);
    write({ anyPokemon: next, slots });
  }

  function addSource(row: TeamSourceRow) {
    setJoining(true);
    setStored(slots);
    write({ sources: [...sources.map((s) => s.id), row.id], slots }, async () => {
      try {
        const next = await api(`/teams/${encodeURIComponent(page.id)}`, teamPage);
        setSources(next.sources);
      } finally {
        setJoining(false);
      }
    });
  }

  function chooseHidden(next: boolean) {
    setHidden(next);
    write({ private: next });
  }

  function choosePool(next: TeamPool) {
    setPool(next);
    write({ pool: next });
  }

  function chooseFreePool(next: FreePool) {
    setFreePool(next);
    write({ freePool: next });
  }

  function save(next: Slots | null) {
    if (!next) return;
    setStored(next);
    write({ slots: next });
  }

  function show(next: Panel) {
    setGlow(null);
    setPanel(next);
  }

  const done = (from: Panel): Panel => ("back" in from && from.back === "sum" ? { t: "sum", slot: from.slot } : { t: "ana" });
  const backLabel = (from: Panel) => ("back" in from && from.back === "sum" ? t.backSummary : t.backAnalysis);
  const backOf = (slot: number): Back => (panel.t === "sum" && panel.slot === slot) || ("back" in panel && panel.back === "sum" && panel.slot === slot) ? "sum" : "ana";

  const focusOf = (slot: number): Focus => {
    if (panel.t === "ana" || panel.slot !== slot) return null;
    if (panel.t === "sum") return "look";
    if (panel.t === "move") return { move: panel.at };
    return panel.t;
  };

  async function pasted(next: Slots): Promise<string> {
    const made = await api("/teams", teamMade, { body: { sources: sources.map((s) => s.id), anyPokemon, slots: next, pool, freePool } });
    return made.id;
  }

  const sourceCount = held.length + (anyPokemon ? 1 : 0);

  const cards = (
    <ol
      aria-label={t.members}
      style={{ "--rows": Math.ceil(slots.length / 2) } as CSSProperties}
      className="m-0 grid min-h-0 list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:flex-1 lg:grid-rows-[repeat(var(--rows),minmax(188px,246px))] lg:content-start lg:overflow-y-auto"
    >
      {slots.map((member, slot) => {
        const mon = memberMon(member, stocks);
        const own = stocks.get(ownOf(member)?.source ?? "");
        return (
          <li key={slot} className="flex min-h-0 lg:[container:card/size]">
            {member && mon && (own || isFree(member)) ? (
              <MemberCard
                member={member}
                mon={mon}
                from={own ? { owner: own.owner, colour: own.colour } : null}
                focus={focusOf(slot)}
                glow={glow === slot}
                editable={editable}
                pick={
                  pickMode
                    ? {
                        in: picked.includes(slot),
                        off: !picked.includes(slot) && picked.length >= PICK_SIZE,
                        onToggle: () => {
                          const next = togglePicked(picked, slot);
                          if (next) choosePick({ ...pick, slots: next });
                        },
                      }
                    : undefined
                }
                onLook={() => show(panel.t === "sum" && panel.slot === slot ? { t: "ana" } : { t: "sum", slot })}
                onItem={() => show({ t: "item", slot, back: backOf(slot) })}
                onAbility={() => show({ t: "ability", slot, back: backOf(slot) })}
                onNature={() => show({ t: "nature", slot, back: backOf(slot) })}
                natureFrom={natureFrom(slots, stocks, slot)}
                setaCost={own?.costs.abilitySetas ?? 0}
                moveRule={pool.moves}
                freePool={freePool}
                onMove={(at) => show({ t: "move", slot, at, back: backOf(slot) })}
                onSet={() => show({ t: "set", slot, back: backOf(slot) })}
                onRemove={() => {
                  show({ t: "ana" });
                  if (pick.slots?.includes(slot)) choosePick({ ...pick, slots: pick.slots.filter((at) => at !== slot) });
                  save(removeMember(slots, slot));
                }}
              />
            ) : (
              <EmptyCard editable={editable} on={adding === slot} onAdd={() => setAdding(slot)} />
            )}
          </li>
        );
      })}
    </ol>
  );

  const editor = panelBody();
  const analysis = (
    <>
      {size > TEAM_SIZE && <ScopeSwitch scope={pickMode ? "six" : "all"} filled={filledAt(slots).length} picked={picked.length} onScope={(scope) => choosePick({ ...pick, scope })} />}
      <SheetAnalysis slots={analysed} stocks={stocks} name={name} pool={pool} onPool={owned ? choosePool : undefined} />
    </>
  );

  function panelBody() {
    if (panel.t === "ana") return null;
    const member = slots[panel.slot];
    const mon = memberMon(member, stocks);
    const own = stocks.get(ownOf(member)?.source ?? "");
    if (!member || !mon || (!own && !isFree(member))) return null;
    const sheet = own?.sheet ?? EMPTY_SHEET;
    if (panel.t === "sum") {
      const shown = asSet(mon, member, pool.moves);
      return (
        <>
          <div className="flex flex-none items-center px-2.5 pt-2">
            <button
              type="button"
              onClick={() => show({ t: "ana" })}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 font-heading text-[1.375rem] text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              {t.analysis}
            </button>
          </div>
          <SummaryHead mon={shown} title={(text) => <h2 className="m-0 truncate font-heading text-[2.625rem] leading-[0.85] font-normal">{text}</h2>} />
          <SummaryBody key={`${panel.slot}:${ownOf(member)?.source ?? "free"}:${mon.index}`} mon={shown} tms={own?.tms ?? []} gaps={own?.gaps ?? []} series={own?.series} />
        </>
      );
    }
    const back = () => show(done(panel));
    if (panel.t === "set") {
      if (!isFree(member) || !spreadShown(member)) return null;
      return <SetEditor key={panel.slot} member={member} back={backLabel(panel)} onBack={back} onChange={(set) => save(setFree(slots, panel.slot, set))} />;
    }
    if (panel.t === "item") {
      return (
        <ItemEditor
          key={panel.slot}
          sheet={sheet}
          slots={slots}
          stocks={stocks}
          slot={panel.slot}
          owner={own?.owner ?? ""}
          back={backLabel(panel)}
          onBack={back}
          onGive={(item) => {
            save(giveItem(sheet, slots, panel.slot, item));
            back();
          }}
          onTake={() => {
            save(takeItem(slots, panel.slot));
            back();
          }}
        />
      );
    }
    if (panel.t === "ability") {
      return (
        <AbilityEditor
          key={panel.slot}
          slots={slots}
          stocks={stocks}
          slot={panel.slot}
          back={backLabel(panel)}
          onBack={back}
          onPick={(ability) => {
            save(setAbility(slots, panel.slot, ability, isFree(member) ? null : currentAbility(mon)));
            back();
          }}
        />
      );
    }
    if (panel.t === "nature") {
      return (
        <NatureEditor
          key={panel.slot}
          slots={slots}
          stocks={stocks}
          slot={panel.slot}
          back={backLabel(panel)}
          onBack={back}
          onPick={(nature, current) => {
            save(isFree(member) ? setFree(slots, panel.slot, { nature }) : setNature(slots, panel.slot, nature, current));
            back();
          }}
        />
      );
    }
    return (
      <MoveEditor
        key={`${panel.slot}:${panel.at}`}
        sheet={sheet}
        mon={mon}
        movesGen={movesGen}
        rule={pool.moves}
        freePool={freePool}
        moves={member.moves}
        at={panel.at}
        back={backLabel(panel)}
        onBack={back}
        onPick={(move) => {
          save(setMove(slots, panel.slot, panel.at, move));
          back();
        }}
      />
    );
  }

  const summary = panel.t === "sum";
  const overspent = held.some((h) => setasLeft(slots, stocks, h.id) < 0 || (moneyLeft(slots, stocks, h.id) ?? 0) < 0);
  const sourceChips = (
    <>
      {held.map((h) => (
        <SourceChip
          key={h.id}
          held={h}
          setas={setasLeft(slots, stocks, h.id)}
          money={moneyLeft(slots, stocks, h.id)}
          onRemove={owned && !fixed && sourceCount > 1 && usedBy(slots, h.id) === 0 ? () => removeSource(h.id) : undefined}
        />
      ))}
      {anyPokemon && <AnyChip onRemove={owned && !fixed && sourceCount > 1 && freeCount(slots) === 0 ? () => chooseAny(false) : undefined} />}
    </>
  );

  return (
    <main className={cn(toolPage, "gap-4 pt-4.5 pb-6 lg:max-h-[calc(var(--screen-h)-4rem)] lg:min-h-160 lg:pb-7")}>
      <div className="flex flex-none flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <TeamsBackLink />
          <div className="flex flex-wrap items-center gap-3.5">
            <Title name={name} editable={owned} onRename={(next) => {
              setName(next);
              write({ name: next });
            }} />
            {!page.mine && (
              <span className={cn("rounded-sm px-2 py-px font-heading text-xl text-ink", PLAYER_FILL[playerColour(page.owner.name) % PLAYER_FILL.length])}>{t.ownerTeam(page.owner.name)}</span>
            )}
            {!page.mine && !page.lockedAt && (
              <span title={t.onlyOwner(page.owner.name)} className="flex items-center gap-1.5 rounded-sm border-2 border-warning bg-warning-soft px-2 py-px font-heading text-xl text-warning-ink">
                <Lock className="size-4 text-warning" aria-hidden="true" />
                {t.viewOnly}
              </span>
            )}
            {page.lockedAt && (
              <span className="flex min-h-8.5 items-center gap-2 rounded-lg border-3 border-trophy-rim bg-trophy pr-3 pl-2.5 font-heading text-xl text-yellow">
                <PixelIcon name="lock" className="size-3.5" />
                {page.league?.kind === "cup" ? t.lockedTo(cupStage(page.league)) : page.league?.kind === "round" ? t.lockedTo(t.round(page.league.round)) : t.locked}
              </span>
            )}
            {page.fix && (
              <span title={t.fixTitle} className="font-heading text-xl text-muted-foreground">
                {t.fixedBy(page.fix.by, setAt(page.fix.at))}
              </span>
            )}
            {sourceCount > FOLD_AFTER ? (
              <SourcesFold held={held} anyPokemon={anyPokemon} over={overspent}>
                {sourceChips}
              </SourcesFold>
            ) : (
              sourceChips
            )}
            {owned && !fixed && <SourceMenu taken={held.map((h) => h.id)} busy={joining} onPick={addSource} onAny={anyPokemon ? undefined : () => chooseAny(true)} />}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-3">
          {page.mine && hasToggle(teamKind(page), page.lockedAt !== null) && <SeenSwitch hidden={hidden} onHidden={chooseHidden} />}
          {owned && !fixed && <SizeSwitch size={size} least={lastFilled(slots)} onSize={(next) => save(resized(slots, next))} />}
          {owned && <MovesSwitch rule={pool.moves} onRule={(moves) => choosePool({ ...pool, moves })} />}
          {owned && !fixed && (
            <button type="button" onClick={() => setPasting(true)} className={buttonVariants({ className: "min-h-12" })}>
              {t.paste}
            </button>
          )}
          {page.canUnlock && <UnlockButton id={page.id} onDone={onReload} />}
          <CopyButton slots={slots} stocks={stocks} />
          {page.canClone && <CloneButton id={page.id} />}
          {page.canLock && (
            <LockButton
              id={page.id}
              name={name}
              filled={filledAt(slots).length}
              need={lockNeeds(page.league?.kind === "round" ? "round" : "cup", size, page.sources[0]?.snapshot.pokemon.map((mon) => speciesTags(mon.species)) ?? null)}
              size={size}
              settled={() => writes.current}
              onDone={onReload}
            />
          )}
          {owned && !fixed && <DeleteButton id={page.id} name={name} />}
        </div>
      </div>
      {page.canFix && <p className="m-0 font-heading text-xl text-subtle">{t.fixing}</p>}
      {failed && (
        <p role="alert" className="m-0 text-destructive">
          {t.notSaved(failed)}
        </p>
      )}
      {wide ? (
        <div className="flex min-h-0 flex-1 gap-6">
          <div className="flex min-h-0 w-[min(896px,62%)] flex-none flex-col">{cards}</div>
          <section
            aria-label={panel.t === "ana" ? t.analysis : summary ? t.summary : t.editor}
            className={cn(
              "flex min-w-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-[18px] border-3 bg-card",
              panel.t === "ana" ? "border-border" : "border-primary",
              summary ? "p-0" : "px-3.5 pt-3 pb-3.5",
            )}
          >
            {editor ?? analysis}
          </section>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t.teamView} className={cn(segTrack, "w-full")}>
            {(
              [
                ["members", t.members],
                ["analysis", t.analysis],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn(segButton(tab === value), "flex-1 text-[1.4375rem]")}>
                {label}
              </button>
            ))}
          </div>
          {tab === "members" ? (
            cards
          ) : (
            <section aria-label={t.analysis} className="flex min-h-[calc(var(--screen-h)*0.8)] flex-col gap-2.5 rounded-[18px] border-3 bg-card px-3.5 pt-3 pb-3.5">
              {analysis}
            </section>
          )}
          <Dialog open={editor !== null} onOpenChange={(open) => !open && show({ t: "ana" })}>
            <DialogContent
              showCloseButton={false}
              aria-describedby={undefined}
              className="inset-0 top-0 left-0 flex h-(--screen-h) w-(--screen-w) max-w-none translate-x-0 translate-y-0 flex-col gap-2.5 rounded-none border-0 bg-card p-0 ring-0 sm:max-w-none"
            >
              <DialogTitle className="sr-only">{summary ? t.summary : t.editor}</DialogTitle>
              <div className={cn("flex min-h-0 flex-1 flex-col gap-2.5", !summary && "px-4 pt-4 pb-5")}>{editor}</div>
              {summary && (
                <DialogPrimitive.Close
                  aria-label={t.close}
                  className="absolute top-3 right-3 grid size-10 cursor-pointer place-items-center rounded-[10px] border-3 border-cell-hi bg-cell text-subtle outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-5" aria-hidden="true" />
                </DialogPrimitive.Close>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
      {editable && (
        <AddDialog
          slot={adding}
          slots={slots}
          stocks={stocks}
          sources={held}
          anyPokemon={anyPokemon}
          pool={pool}
          freePool={freePool}
          onFreePool={owned ? chooseFreePool : setFreePool}
          onClose={() => setAdding(null)}
          onPut={(slot, mon, source) => {
            save(putMember(slots, slot, mon, source));
            setAdding(null);
            setPanel({ t: "ana" });
            setGlow(slot);
          }}
          onPutFree={(slot, member) => {
            save(putFree(slots, slot, member));
            setAdding(null);
            setPanel({ t: "ana" });
            setGlow(slot);
          }}
        />
      )}
      {owned && (
        <PasteDialog
          stocks={stocks}
          any={anyPokemon ? ANY_POKEMON : null}
          open={pasting}
          onOpenChange={setPasting}
          onImport={pasted}
          onOpen={(made) => void navigate({ to: FROM, params: { id: made } })}
        />
      )}
    </main>
  );
}

const FOLD_AFTER = 3;

function SourcesFold({ held, anyPokemon, over, children }: { held: readonly Held[]; anyPokemon: boolean; over: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const count = held.length + (anyPokemon ? 1 : 0);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex min-h-8.5 cursor-pointer items-center gap-2 rounded-lg border-3 bg-ink pr-2.5 pl-1.5 font-heading text-xl text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          open ? "border-primary" : over ? "border-coral" : "border-border",
        )}
      >
        <span aria-hidden="true" className="flex">
          {held.map((h, at) => (
            <span key={h.id} className={cn("grid size-5 place-items-center rounded-[5px] text-base text-ink shadow-[0_0_0_2px_var(--ink)]", PLAYER_FILL[h.colour % PLAYER_FILL.length], at > 0 && "-ml-1.5")}>
              {h.owner.charAt(0).toUpperCase()}
            </span>
          ))}
          {anyPokemon && (
            <span className={cn("grid size-5 place-items-center rounded-[5px] border-2 border-dashed border-faint bg-ink shadow-[0_0_0_2px_var(--ink)]", held.length > 0 && "-ml-1.5")}>
              <AnyMark className="size-2.5" />
            </span>
          )}
        </span>
        {t.sources(count)}
        {over && (
          <span title={t.overspent} className="text-coral">
            !<span className="sr-only">{t.overspent}</span>
          </span>
        )}
        <ChevronDown className={cn("size-4 text-muted-foreground", open && "rotate-180")} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} aria-label={t.sources(count)} className="w-auto gap-1.5 p-2 whitespace-nowrap">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function SourceChip({ held, setas, money, onRemove }: { held: Held; setas: number; money: number | null; onRemove?: () => void }) {
  return (
    <span className={cn("flex min-h-8.5 items-center gap-2 rounded-lg border-3 bg-ink pl-1.5 font-heading text-xl", onRemove ? "pr-1" : "pr-3")}>
      <span aria-hidden="true" className={cn("grid size-5 place-items-center rounded-[5px] text-base text-ink", PLAYER_FILL[held.colour % PLAYER_FILL.length])}>
        {held.owner.charAt(0).toUpperCase()}
      </span>
      {held.label}
      <span title={t.setasLeft} className={cn("ml-0.5 flex items-center gap-0.75", setas < 0 ? "text-coral" : "text-subtle")}>
        <MiniSeta className="size-4" />
        {setas}
        <span className="sr-only">{t.setasLeft}</span>
      </span>
      <span title={money === null ? t.noMoney : t.moneyLeft} className={cn("tabular-nums", money !== null && money < 0 ? "text-coral" : "text-subtle")}>
        {money === null ? "$?" : formatMoney(money)}
        <span className="sr-only">{` ${money === null ? t.noMoney : t.moneyLeft}`}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={t.remove(held.label)}
          title={t.removeSource}
          onClick={onRemove}
          className="grid size-6 cursor-pointer place-items-center rounded-md border-2 border-cell-hi bg-cell p-0 text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

function AnyChip({ onRemove }: { onRemove?: () => void }) {
  return (
    <span className={cn("flex min-h-8.5 items-center gap-2 rounded-lg border-3 border-dashed border-faint bg-ink pl-2 font-heading text-xl", onRemove ? "pr-1" : "pr-3")}>
      <AnyMark />
      {t.any}
      {onRemove && (
        <button
          type="button"
          aria-label={t.removeAny}
          title={t.removeSource}
          onClick={onRemove}
          className="grid size-6 cursor-pointer place-items-center rounded-md border-2 border-cell-hi bg-cell p-0 text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

function SourceMenu({ taken, busy, onPick, onAny }: { taken: readonly string[]; busy: boolean; onPick: (row: TeamSourceRow) => void; onAny?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen(!open)}
        className="flex min-h-8.5 cursor-pointer items-center gap-2 rounded-lg border-none bg-white/10 px-3 font-heading text-xl text-subtle outline-none enabled:hover:bg-white/18 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-45"
      >
        <Plus className="size-3.5 text-primary" aria-hidden="true" />
        {t.source}
      </button>
      {open && <SnapshotMenu label={t.addSource} taken={taken} onClose={() => setOpen(false)} onPick={onPick} onAny={onAny} className="top-10 left-0" />}
    </span>
  );
}

function SeenSwitch({ hidden, onHidden }: { hidden: boolean; onHidden: (hidden: boolean) => void }) {
  return (
    <div role="radiogroup" aria-label={t.seenBy} className="flex items-center gap-1 rounded-xl border-3 bg-ink p-1">
      <span aria-hidden="true" className="pr-1.5 pl-2 font-heading text-xl text-muted-foreground">
        {t.seenBy}
      </span>
      {(
        [
          [true, t.private, t.privateTitle],
          [false, t.public, t.publicTitle],
        ] as const
      ).map(([value, label, title]) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={hidden === value}
          title={title}
          onClick={() => hidden !== value && onHidden(value)}
          className={cn(
            "min-h-9 cursor-pointer rounded-lg border-none px-3 font-heading text-[1.375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            hidden === value ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SizeSwitch({ size, least, onSize }: { size: number; least: number; onSize: (size: number) => void }) {
  return (
    <div role="radiogroup" aria-label={t.members} className="flex items-center gap-1 rounded-xl border-3 bg-ink p-1">
      <span aria-hidden="true" className="pr-1.5 pl-2 font-heading text-xl text-muted-foreground">
        {t.members}
      </span>
      {TEAM_SIZES.map((n) => {
        const off = n !== size && n < least;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === size}
            aria-label={t.memberCount(n)}
            disabled={off}
            onClick={() => n !== size && onSize(n)}
            className={cn(
              "min-h-9 min-w-10 rounded-lg border-none px-3 font-heading text-[1.375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer disabled:opacity-45",
              n === size ? "bg-border text-white" : "bg-transparent text-muted-foreground enabled:hover:bg-cell enabled:hover:text-white",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function MovesSwitch({ rule, onRule }: { rule: MoveRule; onRule: (rule: MoveRule) => void }) {
  const wide = useMediaQuery("(min-width: 40rem)");
  if (!wide) {
    return (
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="pl-1 font-heading text-xl text-muted-foreground">
          {t.moves}
        </span>
        <SelectField label={t.moves} value={rule} options={MOVE_RULES.map((r) => ({ value: r, label: MOVE_RULE_LABELS[r] }))} onChange={(next) => onRule(next as MoveRule)} />
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label={t.moves} className="flex items-center gap-1 rounded-xl border-3 bg-ink p-1">
      <span aria-hidden="true" className="pr-1.5 pl-2 font-heading text-xl text-muted-foreground">
        {t.moves}
      </span>
      {MOVE_RULES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={r === rule}
          onClick={() => r !== rule && onRule(r)}
          className={cn(
            "min-h-9 cursor-pointer rounded-lg border-none px-3 font-heading text-[1.375rem] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            r === rule ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
          )}
        >
          {MOVE_RULE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function ScopeSwitch({ scope, filled, picked, onScope }: { scope: Scope; filled: number; picked: number; onScope: (scope: Scope) => void }) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-2.5">
      <span id="scope-label" className="pl-1 font-heading text-xl text-muted-foreground">
        {t.analyse}
      </span>
      <div role="radiogroup" aria-labelledby="scope-label" className="flex gap-1 rounded-xl border-3 bg-ink p-1">
        {(
          [
            ["all", t.all(filled)],
            ["six", t.pickN(PICK_SIZE)],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            onClick={() => onScope(value)}
            className={cn(
              "min-h-9 cursor-pointer rounded-lg border-none px-3 font-heading text-[1.375rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              scope === value ? "bg-border text-white" : "bg-transparent text-muted-foreground hover:bg-cell hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {scope === "six" && (
        <span role="status" className={cn("font-heading text-xl", picked < PICK_SIZE ? "text-warning" : "text-muted-foreground")}>
          {t.pickedOf(picked, PICK_SIZE)}
        </span>
      )}
    </div>
  );
}

function Title({ name, editable, onRename }: { name: string; editable: boolean; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const heading = "m-0 font-heading text-5xl leading-[0.85] font-normal sm:text-[3.375rem]";
  if (!editable) return <h1 className={heading}>{name}</h1>;
  if (draft === null) {
    return (
      <h1 className={heading}>
        <button
          type="button"
          title={t.rename}
          onClick={() => setDraft(name)}
          className="cursor-text rounded-md border-none bg-transparent p-0 text-left font-[inherit] text-[length:inherit] leading-[inherit] text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {name}
        </button>
      </h1>
    );
  }
  function commit() {
    const parsed = teamName.safeParse(draft);
    setDraft(null);
    if (parsed.success && parsed.data !== name) onRename(parsed.data);
  }
  return (
    <input
      autoFocus
      aria-label={t.teamName}
      value={draft}
      maxLength={60}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(null);
      }}
      className="h-13 w-[min(28rem,100%)] rounded-lg border-3 bg-ink px-2.5 font-heading text-[2.5rem] text-foreground outline-none focus-visible:border-primary"
    />
  );
}

function CopyButton({ slots, stocks }: { slots: Slots; stocks: Stocks }) {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const text = showdownTeam(slots, stocks);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      disabled={text === ""}
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setCopied("copied"),
          () => setCopied("failed"),
        )
      }
      className={buttonVariants({ className: "min-h-12" })}
    >
      {copied === "copied" ? <ClipboardCheck className="size-4 text-primary" aria-hidden="true" /> : <ClipboardCopy className="size-4" aria-hidden="true" />}
      {copied === "copied" ? t.copied : copied === "failed" ? t.copyFailed : t.copy}
    </button>
  );
}

function LockButton({
  id,
  name,
  filled,
  need,
  size,
  settled,
  onDone,
}: {
  id: string;
  name: string;
  filled: number;
  need: number;
  size: number;
  settled: () => Promise<unknown>;
  onDone: () => void;
}) {
  const full = filled >= need;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lock() {
    setBusy(true);
    setError(null);
    try {
      await settled();
      await api(`/teams/${encodeURIComponent(id)}/lock`, teamDone, { method: "POST" });
      setOpen(false);
      onDone();
      recountTeamsToBuild();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={!full}
        title={full ? undefined : t.fillFirst(need, size)}
        onClick={() => setOpen(true)}
        className={buttonVariants({ variant: "go", className: "min-h-12" })}
      >
        <PixelIcon name="lock" className="size-3.5" />
        {t.lockIn}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="bg-card sm:max-w-sm">
          <DialogTitle className="font-heading text-2xl">{t.lockName(name)}</DialogTitle>
          <p className="m-0 text-subtle">{t.lockNote}</p>
          {error && (
            <p role="alert" className="m-0 text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{t.cancel}</Button>
            <Button variant="go" disabled={busy} onClick={() => void lock()}>
              {t.lockIn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CloneButton({ id }: { id: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        title={t.cloneTitle}
        onClick={() => {
          setBusy(true);
          setError(null);
          api(`/teams/${encodeURIComponent(id)}/clone`, teamMade, { method: "POST" }).then(
            (made) => void navigate({ to: FROM, params: { id: made.id } }),
            (caught: unknown) => {
              setError(message(caught));
              setBusy(false);
            },
          );
        }}
        className={buttonVariants({ className: "min-h-12" })}
      >
        <CopyPlus className="size-4" aria-hidden="true" />
        {t.clone}
      </button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

function UnlockButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          api(`/teams/${encodeURIComponent(id)}/unlock`, teamDone, { method: "POST" }).then(onDone, (caught: unknown) => {
            setError(message(caught));
            setBusy(false);
          });
        }}
        className={buttonVariants({ className: "min-h-12" })}
      >
        <PixelIcon name="unlock" className="size-3.5 text-yellow" />
        {t.unlock}
      </button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ variant: "destructive", className: "min-h-12" })}>
        {t.delete}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="bg-card sm:max-w-sm">
          <DialogTitle className="font-heading text-2xl">{t.deleteName(name)}</DialogTitle>
          {error && (
            <p role="alert" className="m-0 text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>{t.cancel}</Button>
            <Button
              variant="destructive"
              onClick={() =>
                void api(`/teams/${encodeURIComponent(id)}`, teamDone, { method: "DELETE" }).then(
                  () => navigate({ to: "/teams" }),
                  (caught: unknown) => setError(message(caught)),
                )
              }
            >
              {t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
