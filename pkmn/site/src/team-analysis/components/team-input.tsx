import { useEffect, useState } from "react";
import { ClipboardCheck, ClipboardCopy, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Member } from "@/analysis/member";
import { SAMPLES } from "@/analysis/samples";
import { TypeDot } from "@/open-sheet/components/marks";
import { buttonClass, fieldClass, primaryClass, Toggle } from "@/team-analysis/components/controls";
import { spriteOf } from "@/team-analysis/sprite";

export interface TeamStatus {
  failed: string[];
  unknownMoves: string[];
  laterMoves: string[];
  illegal: Map<Member, string>;
}

export function teamStatus(team: readonly Member[], failed: string[], legality: (m: Member) => string | null): TeamStatus {
  const illegal = new Map<Member, string>();
  for (const m of team) {
    const why = legality(m);
    if (why) illegal.set(m, why);
  }
  return {
    failed,
    unknownMoves: team.flatMap((m) => m.moves.filter((mv) => mv.unknown).map((mv) => `${mv.name} (${m.set.species})`)),
    laterMoves: team.flatMap((m) => m.moves.filter((mv) => mv.notInGen).map((mv) => `${mv.name} (${m.set.species})`)),
    illegal,
  };
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"copied" | "failed" | null>(null);
  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => setState(null), 1500);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <button
      type="button"
      disabled={!text.trim()}
      onClick={() => navigator.clipboard.writeText(text).then(() => setState("copied"), () => setState("failed"))}
      className={cn(buttonClass, "ml-auto")}
    >
      {state === "copied" ? (
        <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
      ) : (
        <ClipboardCopy className="size-4" aria-hidden="true" />
      )}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy for Showdown"}
    </button>
  );
}

export function TeamInput({
  draft,
  committed,
  team,
  archetype,
  status,
  useTera,
  teraAllowed,
  onDraft,
  onAnalyse,
  onTera,
}: {
  draft: string;
  committed: string;
  team: readonly Member[];
  archetype: string | null;
  status: TeamStatus;
  useTera: boolean;
  teraAllowed: boolean;
  onDraft: (text: string) => void;
  onAnalyse: (text: string) => void;
  onTera: (useTera: boolean) => void;
}) {
  const notes = [
    status.failed.length > 0 && `Not found: ${status.failed.join(", ")}.`,
    status.unknownMoves.length > 0 && `Unknown moves ignored: ${status.unknownMoves.join(", ")}.`,
    status.laterMoves.length > 0 && `Moves from a later generation ignored: ${status.laterMoves.join(", ")}.`,
  ].filter((n): n is string => typeof n === "string");

  return (
    <section aria-label="Team" className="grid grid-cols-1 gap-4 rounded-2xl border bg-card p-3.5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-2.5">
        <label htmlFor="paste" className="text-xs font-semibold text-muted-foreground">
          Showdown team
        </label>
        <textarea
          id="paste"
          spellCheck={false}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onAnalyse(draft);
          }}
          placeholder={"Latios @ Life Orb\nAbility: Levitate\nLevel: 50\nTimid Nature\n- Draco Meteor\n- Psyshock"}
          className="h-40 resize-y rounded-lg border bg-muted p-2.5 font-mono text-xs leading-normal text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onAnalyse(draft)} disabled={!draft.trim()} className={primaryClass}>
            Analyse
          </button>
          <label className={cn(fieldClass, "pr-1.5")}>
            <span className="text-muted-foreground">Sample</span>
            <select
              value=""
              onChange={(e) => {
                const text = SAMPLES[e.target.value];
                if (text) {
                  onDraft(text);
                  onAnalyse(text);
                }
              }}
              className="bg-transparent text-foreground"
            >
              <option value="" disabled>
                Pick…
              </option>
              {Object.keys(SAMPLES).map((name) => (
                <option key={name} value={name} className="bg-card">
                  {name}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            pressed={useTera && teraAllowed}
            disabled={!teraAllowed}
            title={teraAllowed ? undefined : "Tera exists from Gen 9"}
            onChange={onTera}
          >
            Defend as Tera
          </Toggle>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 font-heading text-[26px] font-bold">Team</h2>
          {archetype && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-primary">{archetype}</span>}
          <CopyButton text={committed} />
        </div>
        {team.length === 0 ? (
          <p className="m-0 grid min-h-30 flex-1 place-items-center rounded-xl border-2 border-dashed text-[13px] text-muted-foreground">
            Paste a team or pick a sample.
          </p>
        ) : (
          <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-6">
            {team.map((m, i) => {
              const why = status.illegal.get(m);
              return (
                <div
                  key={i}
                  title={why ? `Not in this pool: ${why}` : undefined}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-box px-1 py-2",
                    why && "ring-2 ring-destructive",
                  )}
                >
                  <img src={spriteOf(m)} alt="" className="size-18 [image-rendering:pixelated]" />
                  <span className="max-w-full truncate text-[13px] font-semibold">{m.display}</span>
                  <span className="flex flex-wrap justify-center gap-1.5 text-[11px] text-muted-foreground">
                    {m.types.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1">
                        <TypeDot type={t} />
                        {t}
                      </span>
                    ))}
                  </span>
                  <span className="max-w-full truncate text-[11px] text-muted-foreground">{m.set.item || "—"}</span>
                  {why && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                      <TriangleAlert className="size-3" aria-hidden="true" />
                      {why}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {notes.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-destructive">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
