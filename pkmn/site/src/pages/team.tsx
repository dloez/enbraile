import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ClipboardCheck, ClipboardCopy, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toolPage } from "@/components/page";
import { MiniSeta } from "@/components/pc/bag";
import { SummaryBody, SummaryHead } from "@/components/pc/summary";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { PLAYER_FILL, playerColour } from "@/components/player-badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AddDialog } from "@/teams/components/add-dialog";
import { AbilityEditor, ItemEditor, segButton, segTrack } from "@/teams/components/editors";
import { EmptyCard, MemberCard, type Focus } from "@/teams/components/member-card";
import { MoveEditor } from "@/teams/components/move-picker";
import { PasteDialog } from "@/teams/components/paste-dialog";
import { SheetAnalysis } from "@/teams/components/sheet-analysis";
import { currentAbility, describeMove, describePokemon, type Mon } from "@/teams/dex";
import { analysedSlots, filledAt, loadPick, pickedOf, savePick, togglePicked, type Pick, type Scope } from "@/teams/pick";
import { showdownTeam } from "@/teams/showdown";
import {
  giveItem,
  lastFilled,
  liveSlots,
  memberMon,
  MINI_SETA,
  putMember,
  quantityOf,
  removeMember,
  resized,
  setAbility,
  setasNeeded,
  setMove,
  takeItem,
  PICK_SIZE,
  TEAM_SIZE,
  TEAM_SIZES,
  type Member,
  type Slots,
} from "@/teams/team";
import { teamDone, teamMade, teamPage, teamName, type TeamPage, type TeamSource } from "../../shared/team";

const FROM = "/teams/$id";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

type Back = "ana" | "sum";

type Panel =
  | { t: "ana" }
  | { t: "sum"; slot: number }
  | { t: "item"; slot: number; back: Back }
  | { t: "ability"; slot: number; back: Back }
  | { t: "move"; slot: number; at: number; back: Back };

export function TeamBuilderPage() {
  const { id } = useParams({ from: FROM });
  const [page, setPage] = useState<TeamPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPage(null);
    setError(null);
    api(`/teams/${encodeURIComponent(id)}`, teamPage).then(
      (next) => live && setPage(next),
      (caught: unknown) => live && setError(message(caught)),
    );
    return () => {
      live = false;
    };
  }, [id]);

  if (error) {
    return (
      <main className={cn(toolPage, "py-7 sm:py-9")}>
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      </main>
    );
  }
  if (!page) return <main className={toolPage} />;
  const source = page.sources[0];
  if (!source) {
    return (
      <main className={cn(toolPage, "gap-4 pt-5")}>
        <BackLink />
        <h1 className="m-0 font-heading text-5xl leading-[0.85] font-normal">{page.name}</h1>
        <p className="m-0 rounded-2xl border-3 border-dashed border-cell-hi bg-box px-5 py-10 text-center font-heading text-3xl text-subtle">
          This team's snapshot was deleted
        </p>
      </main>
    );
  }
  return <Builder key={page.id} page={page} source={source} />;
}

function BackLink() {
  return (
    <Link
      to="/teams"
      className="-my-2.5 flex min-h-11 w-fit items-center gap-1.5 font-heading text-[1.375rem] text-primary decoration-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      Teams
    </Link>
  );
}

function asSet(mon: Mon, member: Member): Mon {
  const ability = member.ability ?? currentAbility(mon);
  return {
    ...mon,
    abilities: mon.abilities.map((a) => ({ ...a, current: a.id === ability })),
    learnable: mon.learnable && { ...mon.learnable, current: member.moves.flatMap((m) => (m ? [describeMove(m)] : [])) },
  };
}

function Builder({ page, source }: { page: TeamPage; source: TeamSource }) {
  const navigate = useNavigate();
  const wide = useMediaQuery("(min-width: 64rem)");
  const sheet = source.snapshot;
  const gaps = source.missing?.missing ?? [];
  const mons = useMemo(() => sheet.pokemon.map(describePokemon), [sheet]);
  const [name, setName] = useState(page.name);
  const [stored, setStored] = useState<Slots>(page.slots);
  const slots = useMemo(() => liveSlots(stored, mons, source.id), [stored, mons, source.id]);
  const [panel, setPanel] = useState<Panel>({ t: "ana" });
  const [adding, setAdding] = useState<number | null>(null);
  const [glow, setGlow] = useState<number | null>(null);
  const [tab, setTab] = useState<"members" | "analysis">("members");
  const [pasting, setPasting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick>(() => loadPick(page.id));
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const editable = page.canEdit;
  const from = source.player.name;
  const colour = playerColour(source.player.id);
  const setasLeft = quantityOf(sheet, MINI_SETA) - setasNeeded(slots, mons);
  const size = slots.length;
  const pickMode = size > TEAM_SIZE && pick.scope === "six";
  const picked = pickedOf(slots, pick);
  const analysed = pickMode ? analysedSlots(slots, picked) : slots;

  function choosePick(next: Pick) {
    setPick(next);
    savePick(page.id, next);
  }

  function write(body: { slots?: Slots; name?: string }) {
    writes.current = writes.current
      .then(() => api(`/teams/${encodeURIComponent(page.id)}`, teamDone, { method: "PUT", body }))
      .then(
        () => setFailed(null),
        (caught: unknown) => setFailed(message(caught)),
      );
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
  const backLabel = (from: Panel) => ("back" in from && from.back === "sum" ? "Back to the summary" : "Back to the analysis");
  const backOf = (slot: number): Back => (panel.t === "sum" && panel.slot === slot) || ("back" in panel && panel.back === "sum" && panel.slot === slot) ? "sum" : "ana";

  const focusOf = (slot: number): Focus => {
    if (panel.t === "ana" || panel.slot !== slot) return null;
    if (panel.t === "sum") return "look";
    if (panel.t === "move") return { move: panel.at };
    return panel.t;
  };

  async function pasted(next: Slots) {
    const made = await api("/teams", teamMade, { body: { snapshot: source.id, slots: next } });
    await navigate({ to: FROM, params: { id: made.id } });
  }

  const cards = (
    <ol aria-label="Members" className="m-0 grid min-h-0 list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:flex-1 lg:auto-rows-[minmax(206px,1fr)] lg:overflow-y-auto">
      {slots.map((member, slot) => {
        const mon = memberMon(member, mons);
        return (
          <li key={slot} className="flex min-h-0">
            {member && mon ? (
              <MemberCard
                member={member}
                mon={mon}
                from={from}
                colour={colour}
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
                onMove={(at) => show({ t: "move", slot, at, back: backOf(slot) })}
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
      <SheetAnalysis slots={analysed} mons={mons} name={name} />
    </>
  );

  function panelBody() {
    if (panel.t === "ana") return null;
    const member = slots[panel.slot];
    const mon = memberMon(member, mons);
    if (!member || !mon) return null;
    if (panel.t === "sum") {
      const shown = asSet(mon, member);
      return (
        <>
          <div className="flex flex-none items-center px-2.5 pt-2">
            <button
              type="button"
              onClick={() => show({ t: "ana" })}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 font-heading text-[1.375rem] text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Analysis
            </button>
          </div>
          <SummaryHead mon={shown} title={(text) => <h2 className="m-0 truncate font-heading text-[2.625rem] leading-[0.85] font-normal">{text}</h2>} />
          <SummaryBody key={`${panel.slot}:${mon.index}`} mon={shown} sheet={sheet} gaps={gaps} />
        </>
      );
    }
    const back = () => show(done(panel));
    if (panel.t === "item") {
      return (
        <ItemEditor
          key={panel.slot}
          sheet={sheet}
          slots={slots}
          mons={mons}
          slot={panel.slot}
          owner={from}
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
          mons={mons}
          slot={panel.slot}
          setasLeft={setasLeft}
          back={backLabel(panel)}
          onBack={back}
          onPick={(ability) => {
            save(setAbility(slots, panel.slot, ability, currentAbility(mon)));
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

  return (
    <main className={cn(toolPage, "gap-4 pt-4.5 pb-6 lg:max-h-[calc(100svh-4rem)] lg:min-h-160 lg:pb-7")}>
      <div className="flex flex-none flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <BackLink />
          <div className="flex flex-wrap items-center gap-3.5">
            <Title name={name} editable={editable} onRename={(next) => {
              setName(next);
              write({ name: next });
            }} />
            {!editable && (
              <span className={cn("rounded-sm px-2 py-px font-heading text-xl text-ink", PLAYER_FILL[playerColour(page.owner.id) % PLAYER_FILL.length])}>{page.owner.name}'s team</span>
            )}
            <span className="flex min-h-8.5 items-center gap-2 rounded-lg border-3 bg-ink pr-3 pl-1.5 font-heading text-xl">
              <span aria-hidden="true" className={cn("grid size-5 place-items-center rounded-[5px] text-base text-ink", PLAYER_FILL[colour % PLAYER_FILL.length])}>
                {from.charAt(0).toUpperCase()}
              </span>
              {from}'s PC · {source.milestone}
              <span title="Mini Setas left" className={cn("ml-0.5 flex items-center gap-0.75", setasLeft < 0 ? "text-coral" : "text-subtle")}>
                <MiniSeta className="size-4" />
                {setasLeft}
                <span className="sr-only">Mini Setas left</span>
              </span>
            </span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-3">
          {editable && <SizeSwitch size={size} least={lastFilled(slots)} onSize={(next) => save(resized(slots, next))} />}
          {editable && (
            <button type="button" onClick={() => setPasting(true)} className={buttonVariants({ className: "min-h-12" })}>
              Paste
            </button>
          )}
          <CopyButton slots={slots} mons={mons} />
          {editable && <DeleteButton id={page.id} name={name} />}
        </div>
      </div>
      {failed && (
        <p role="alert" className="m-0 text-destructive">
          Not saved: {failed}
        </p>
      )}
      {wide ? (
        <div className="flex min-h-0 flex-1 gap-6">
          <div className="flex min-h-0 w-[min(896px,62%)] flex-none flex-col">{cards}</div>
          <section
            aria-label={panel.t === "ana" ? "Analysis" : summary ? "Summary" : "Editor"}
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
          <div role="tablist" aria-label="Team view" className={cn(segTrack, "w-full")}>
            {(
              [
                ["members", "Members"],
                ["analysis", "Analysis"],
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
            <section aria-label="Analysis" className="flex min-h-[80svh] flex-col gap-2.5 rounded-[18px] border-3 bg-card px-3.5 pt-3 pb-3.5">
              {analysis}
            </section>
          )}
          <Dialog open={editor !== null} onOpenChange={(open) => !open && show({ t: "ana" })}>
            <DialogContent
              showCloseButton={false}
              aria-describedby={undefined}
              className="inset-0 top-0 left-0 flex h-svh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-2.5 rounded-none border-0 bg-card p-0 ring-0 sm:max-w-none"
            >
              <DialogTitle className="sr-only">{summary ? "Summary" : "Editor"}</DialogTitle>
              <div className={cn("flex min-h-0 flex-1 flex-col gap-2.5", !summary && "px-4 pt-4 pb-5")}>{editor}</div>
              {summary && (
                <DialogPrimitive.Close
                  aria-label="Close"
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
          mons={mons}
          sheet={sheet}
          gaps={gaps}
          source={`${from}'s PC · ${source.milestone}`}
          onClose={() => setAdding(null)}
          onPut={(slot, mon) => {
            save(putMember(slots, slot, mon, source.id));
            setAdding(null);
            setPanel({ t: "ana" });
            setGlow(slot);
          }}
        />
      )}
      {editable && <PasteDialog sheet={sheet} source={source.id} mons={mons} open={pasting} onOpenChange={setPasting} onImport={pasted} />}
    </main>
  );
}

function SizeSwitch({ size, least, onSize }: { size: number; least: number; onSize: (size: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Members" className="flex items-center gap-1 rounded-xl border-3 bg-ink p-1">
      <span aria-hidden="true" className="pr-1.5 pl-2 font-heading text-xl text-muted-foreground">
        Members
      </span>
      {TEAM_SIZES.map((n) => {
        const off = n !== size && n < least;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === size}
            aria-label={`${n} members`}
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

function ScopeSwitch({ scope, filled, picked, onScope }: { scope: Scope; filled: number; picked: number; onScope: (scope: Scope) => void }) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-2.5">
      <span id="scope-label" className="pl-1 font-heading text-xl text-muted-foreground">
        Analyse
      </span>
      <div role="radiogroup" aria-labelledby="scope-label" className="flex gap-1 rounded-xl border-3 bg-ink p-1">
        {(
          [
            ["all", `All ${filled}`],
            ["six", `Pick ${PICK_SIZE}`],
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
          {picked} of {PICK_SIZE} in
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
          title="Rename the team"
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
      aria-label="Team name"
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

function CopyButton({ slots, mons }: { slots: Slots; mons: readonly Mon[] }) {
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const text = showdownTeam(slots, mons);

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
      {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy for Showdown"}
    </button>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ variant: "destructive", className: "min-h-12" })}>
        Delete
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="bg-card sm:max-w-sm">
          <DialogTitle className="font-heading text-2xl">Delete {name}?</DialogTitle>
          {error && (
            <p role="alert" className="m-0 text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() =>
                void api(`/teams/${encodeURIComponent(id)}`, teamDone, { method: "DELETE" }).then(
                  () => navigate({ to: "/teams" }),
                  (caught: unknown) => setError(message(caught)),
                )
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
