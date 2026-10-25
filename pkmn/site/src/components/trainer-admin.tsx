import { type ReactNode, useEffect, useState } from "react";
import { buttonClass, fieldClass, SelectField } from "@/components/controls";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { overrideDone, type SetByHand, type Trainer, type TrainerSnapshot } from "../../shared/series";

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function when(at: string): string {
  return new Date(at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function Source({ hand, save }: { hand: SetByHand | null; save: string }) {
  return (
    <span className={cn("text-sm", hand ? "text-warning" : "text-muted-foreground")}>
      {hand ? `Set by hand by ${hand.by} · ${when(hand.at)} · save: ${save}` : `From the save`}
    </span>
  );
}

function Row({ label, children, source }: { label: string; children: ReactNode; source?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-heading text-lg text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {source}
    </div>
  );
}

export function TrainerAdmin({
  seriesNumber,
  trainer,
  shown,
  milestones,
  onChanged,
  onMoved,
}: {
  seriesNumber: number;
  trainer: Trainer;
  shown: TrainerSnapshot | undefined;
  milestones: string[];
  onChanged: () => void;
  onMoved: (milestone: string) => void;
}) {
  const base = `/series/${seriesNumber}/trainers/${encodeURIComponent(trainer.id)}`;
  const at = shown ? `${base}/snapshots/${encodeURIComponent(shown.milestone)}` : null;
  const handProgress = trainer.sources?.progress ?? null;
  const fromSave = trainer.snapshots.at(-1)?.milestone ?? "none";
  const free = milestones.filter((m) => !trainer.snapshots.some((s) => s.milestone === m));
  const [fainted, setFainted] = useState(String(shown?.fainted ?? 0));
  const [target, setTarget] = useState(free[0] ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFainted(String(shown?.fainted ?? 0));
    setConfirming(false);
  }, [shown?.milestone, shown?.fainted]);

  useEffect(() => {
    if (!free.includes(target)) setTarget(free[0] ?? "");
  }, [free, target]);

  async function run(path: string, method: string, body?: unknown, then?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await api(path, overrideDone, { method, body });
      then?.();
      onChanged();
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  }

  const count = Number(fainted);
  const validCount = fainted.trim() !== "" && Number.isInteger(count) && count >= 0 && count <= 999;

  return (
    <div className="col-span-2 flex flex-[1_0_100%] flex-col gap-3 rounded-xl border-3 border-dashed border-warning/60 bg-card px-4 py-3">
      <span className="font-heading text-xl text-warning">Admin</span>
      <Row label="Progress" source={<Source hand={handProgress} save={fromSave} />}>
        <SelectField
          label={`${trainer.name}'s progress`}
          size="sm"
          disabled={busy}
          value={handProgress ? (trainer.progress ?? "") : ""}
          onChange={(value) =>
            void (value ? run(`${base}/progress`, "PUT", { milestone: value }) : run(`${base}/progress`, "DELETE"))
          }
          all={`From the save (${fromSave})`}
          options={milestones.map((m) => ({ value: m, label: m }))}
        />
      </Row>
      {shown && at && shown.sources && (
        <>
          <Row label={`Fainted at ${shown.milestone}`} source={<Source hand={shown.sources.fainted} save={String(shown.sources.savedFainted)} />}>
            <input
              type="number"
              min={0}
              max={999}
              aria-label={`${trainer.name}'s fainted count at ${shown.milestone}`}
              value={fainted}
              onChange={(event) => setFainted(event.target.value)}
              className={cn(fieldClass, focus, "w-24 text-base")}
            />
            <button
              type="button"
              disabled={busy || !validCount}
              onClick={() => void run(`${at}/fainted`, "PUT", { count })}
              className={buttonClass}
            >
              Set
            </button>
            {shown.sources.fainted && (
              <button type="button" disabled={busy} onClick={() => void run(`${at}/fainted`, "DELETE")} className={buttonClass}>
                Clear
              </button>
            )}
          </Row>
          <Row
            label={`${shown.milestone} snapshot`}
            source={
              shown.sources.moved && (
                <span className="text-sm text-warning">
                  Moved by {shown.sources.moved.by} · {when(shown.sources.moved.at)}
                </span>
              )
            }
          >
            <SelectField
              label={`Move ${trainer.name}'s ${shown.milestone} snapshot to`}
              size="sm"
              disabled={busy || free.length === 0}
              value={target}
              onChange={setTarget}
              options={free.map((m) => ({ value: m, label: m }))}
            />
            <button
              type="button"
              disabled={busy || !target}
              onClick={() => void run(`${at}/move`, "POST", { milestone: target }, () => onMoved(target))}
              className={buttonClass}
            >
              Move
            </button>
            {confirming ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(at, "DELETE")}
                className={buttonVariants({ variant: "destructive" })}
              >
                Delete {shown.milestone} snapshot
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={buttonVariants({ variant: "destructive" })}>
                Delete
              </button>
            )}
          </Row>
        </>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
