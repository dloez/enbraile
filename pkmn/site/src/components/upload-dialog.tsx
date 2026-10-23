import { CircleAlert, TriangleAlert, X } from "lucide-react";
import { type DragEvent, type ReactNode, useState } from "react";
import { buttonClass } from "@/components/controls";
import { PixelIcon } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { downloadSnapshotZip } from "@/lib/snapshot-zip";
import { sendFile, UploadError } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { type SavedSnapshot, savedSnapshot, type UploadedSave, uploadedSave } from "../../shared/save-upload";
import type { Trainer } from "../../shared/series";

type Step =
  | { name: "file" }
  | { name: "uploading"; progress: number }
  | { name: "uploadFailed"; progress: number; error: string }
  | { name: "refused"; error: string }
  | { name: "pick"; upload: UploadedSave; error: string | null }
  | { name: "exporting"; upload: UploadedSave }
  | { name: "done"; saved: SavedSnapshot };

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function savedWhen(stamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(stamp);
  if (!match) return "";
  const [, , month, day, hour, minute] = match;
  return `Saved ${Number(day)} ${months[Number(month) - 1] ?? ""}, ${hour}:${minute}`;
}

function size(bytes: number): string {
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

function suggestion(slot: UploadedSave["slots"][number]): string {
  if (slot.hallOfFame && slot.hallOfFame > 0) return "From the save · Hall of Fame";
  return `From the save · ${slot.badges ?? 0} ${slot.badges === 1 ? "badge" : "badges"}`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

const goClass = "min-h-13 px-5.5";

export function UploadDialog({
  open,
  onOpenChange,
  seriesNumber,
  trainer,
  forOther,
  milestones,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesNumber: number;
  trainer: Trainer;
  forOther: boolean;
  milestones: readonly string[];
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "file" });
  const [file, setFile] = useState<File | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);
  const base = `/series/${seriesNumber}/trainers/${encodeURIComponent(trainer.id)}`;
  const taken = new Map(trainer.snapshots.map((s) => [s.milestone, s.pokemon]));

  function reset() {
    setStep({ name: "file" });
    setFile(null);
    setSlot(null);
    setMilestone(null);
    setPicked(false);
  }

  function close(next: boolean) {
    if (!next && (step.name === "uploading" || step.name === "exporting")) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function send(chosen: File) {
    setFile(chosen);
    setSlot(null);
    setStep({ name: "uploading", progress: 0 });
    let progress = 0;
    try {
      const done = await sendFile(base, chosen, uploadedSave, (fraction) => {
        progress = fraction;
        setStep({ name: "uploading", progress: fraction });
      });
      const first = done.slots[0];
      setSlot(first.entry);
      setMilestone((current) => (picked && current ? current : (first.suggested ?? current)));
      setStep({ name: "pick", upload: done, error: null });
    } catch (caught) {
      if (caught instanceof UploadError && caught.sent) setStep({ name: "refused", error: message(caught) });
      else setStep({ name: "uploadFailed", progress, error: message(caught) });
    }
  }

  function chooseSlot(upload: UploadedSave, entry: string) {
    setSlot(entry);
    if (!picked) setMilestone(upload.slots.find((s) => s.entry === entry)?.suggested ?? null);
  }

  async function save(upload: UploadedSave) {
    if (!slot || !milestone || !file) return;
    setStep({ name: "exporting", upload });
    try {
      const saved = await api(`${base}/snapshots`, savedSnapshot, {
        body: { key: upload.key, fileName: upload.fileName, slot, milestone },
      });
      setStep({ name: "done", saved });
      onSaved();
    } catch (caught) {
      setStep({ name: "pick", upload, error: message(caught) });
    }
  }

  const current = step.name === "pick" || step.name === "exporting" ? step.upload : null;
  const locked = step.name === "exporting";
  const showMilestones = step.name === "uploading" || step.name === "pick" || step.name === "exporting";
  const ready = step.name === "pick" && !!milestone && !!slot;
  const chosenSlot = current?.slots.find((s) => s.entry === slot);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className={cn(
          "flex max-h-[90svh] flex-col gap-5 overflow-y-auto border-3 bg-card px-6 pt-5.5 pb-6 text-base ring-0 sm:max-w-150",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-b-0",
        )}
      >
        <div className="flex items-center gap-3.5">
          {forOther && <PlayerBadge name={trainer.name} colour={playerColour(trainer.id)} size="sm" />}
          <DialogTitle className="m-0 min-w-0 flex-1 font-heading text-4xl leading-[0.9] font-normal">
            {forOther ? `Upload for ${trainer.name}` : "Upload snapshot"}
          </DialogTitle>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            disabled={locked || step.name === "uploading"}
            onClick={() => close(false)}
            className="grid size-11 flex-none cursor-pointer place-items-center rounded-md text-muted-foreground outline-none hover:bg-face hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {step.name === "file" && <DropZone onFile={(chosen) => void send(chosen)} />}

        {file && step.name !== "file" && step.name !== "done" && <FileRow file={file} step={step} />}

        {(step.name === "uploadFailed" || step.name === "refused" || (step.name === "pick" && step.error)) && (
          <Alert>{step.error}</Alert>
        )}

        {current && current.slots.length > 1 && (
          <div className="flex flex-col gap-2.5">
            <span id="upload-slot" className="font-heading text-2xl leading-none text-muted-foreground">
              Slot
            </span>
            <div role="radiogroup" aria-labelledby="upload-slot" className="flex flex-col gap-2">
              {current.slots.map((s) => {
                const on = s.entry === slot;
                return (
                  <button
                    key={s.entry}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={locked}
                    onClick={() => chooseSlot(current, s.entry)}
                    className={cn(
                      "flex min-h-15 cursor-pointer items-center gap-3.5 rounded-xl border-3 px-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                      on ? "border-primary bg-primary/12" : "border-border bg-box hover:enabled:border-primary",
                    )}
                  >
                    <span className={cn("grid size-5.5 flex-none place-items-center rounded-sm border-3", on ? "border-primary" : "border-cell-hi")}>
                      <span className={cn("size-2", on && "bg-primary")} />
                    </span>
                    <span className="flex-1 font-heading text-3xl leading-none">{s.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">{savedWhen(s.savedAt)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showMilestones && (
          <div className="flex flex-col gap-2.5">
            <span className="flex items-center gap-2.5">
              <span id="upload-milestone" className="font-heading text-2xl leading-none text-muted-foreground">
                Milestone
              </span>
              {chosenSlot && milestone !== null && milestone === chosenSlot.suggested && (
                <span className="rounded-full bg-cell px-2.5 py-0.5 text-xs font-bold text-subtle">{suggestion(chosenSlot)}</span>
              )}
            </span>
            <div
              role="radiogroup"
              aria-labelledby="upload-milestone"
              className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1 rounded-xl border-3 bg-ink p-1"
            >
              {milestones.map((name) => {
                const on = name === milestone;
                const has = taken.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={has ? `${name}, has a snapshot` : name}
                    disabled={locked}
                    onClick={() => {
                      setMilestone(name);
                      setPicked(true);
                    }}
                    className={cn(
                      "relative min-h-12 cursor-pointer rounded-md px-2 font-heading text-2xl whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                      on ? "bg-red text-white" : "bg-cell text-subtle hover:enabled:bg-border hover:enabled:text-white",
                    )}
                  >
                    {name}
                    {has && <span aria-hidden="true" className={cn("absolute top-1.5 right-1.5 size-1.75", on ? "bg-white" : "bg-muted-foreground")} />}
                  </button>
                );
              })}
            </div>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden="true" className="size-1.75 bg-muted-foreground" />
              Has a snapshot
            </span>
            {milestone && taken.has(milestone) && (
              <div className="flex items-center gap-3 rounded-xl border border-warning bg-warning-soft px-4 py-3">
                <TriangleAlert aria-hidden="true" className="size-5 flex-none text-warning" />
                <span className="font-bold text-warning-ink">
                  Replaces {milestone} · {taken.get(milestone)} Pokémon
                </span>
              </div>
            )}
          </div>
        )}

        {step.name === "done" && (
          <div className="flex flex-col items-center gap-3.5 pt-4.5 pb-1.5">
            <span aria-hidden="true" className="grid size-19 place-items-center rounded-2xl border-3 bg-box">
              <PixelIcon name="check" className="size-10 text-chart-2" />
            </span>
            <span className="text-center font-heading text-5xl leading-[0.9]">
              {step.saved.milestone} {step.saved.replaced ? "replaced" : "saved"}
            </span>
            <span className="font-heading text-3xl leading-none text-subtle tabular-nums">{step.saved.pokemon} Pokémon</span>
            <RolledZip
              saved={step.saved}
              onDownload={() => downloadSnapshotZip(seriesNumber, trainer.id, step.saved.milestone)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {step.name !== "done" && (
            <Button variant="ghost" className={cn(goClass, "px-4 hover:text-white")} disabled={locked || step.name === "uploading"} onClick={() => close(false)}>
              Cancel
            </Button>
          )}
          {(step.name === "uploading" || step.name === "pick") && (
            <Button variant="go" className={goClass} disabled={!ready} onClick={() => current && void save(current)}>
              {!milestone ? "Save" : taken.has(milestone) ? `Replace ${milestone}` : `Save as ${milestone}`}
            </Button>
          )}
          {step.name === "exporting" && (
            <Button className={goClass} disabled>
              Exporting…
            </Button>
          )}
          {step.name === "uploadFailed" && (
            <>
              <FileButton className={goClass} onFile={(chosen) => void send(chosen)}>
                Choose another file
              </FileButton>
              <Button variant="go" className={goClass} onClick={() => file && void send(file)}>
                Retry
              </Button>
            </>
          )}
          {step.name === "refused" && (
            <FileButton go className={goClass} onFile={(chosen) => void send(chosen)}>
              Choose another file
            </FileButton>
          )}
          {step.name === "done" && (
            <Button className={goClass} onClick={() => close(false)}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileButton({ children, className, go, onFile }: { children: ReactNode; className?: string; go?: boolean; onFile: (file: File) => void }) {
  return (
    <label
      className={cn(
        buttonClass,
        go && "bg-red hover:bg-red-hi",
        "relative cursor-pointer focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      {children}
      <input
        type="file"
        accept=".zip,application/zip"
        className="absolute size-px opacity-0"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (chosen) onFile(chosen);
        }}
      />
    </label>
  );
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    const chosen = event.dataTransfer.files[0];
    if (chosen) onFile(chosen);
  }

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        "relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-3 border-dashed bg-box px-6 pt-9 pb-8 hover:border-primary focus-within:border-primary",
        over ? "border-primary" : "border-cell-hi",
      )}
    >
      <span aria-hidden="true" className="grid size-18 place-items-center rounded-xl bg-ink">
        <PixelIcon name="upload" className="size-10 text-primary" />
      </span>
      <span className="text-center font-heading text-3xl leading-none">Drop a save zip</span>
      <span className={cn(buttonClass, "pointer-events-none")}>Choose file</span>
      <input
        type="file"
        accept=".zip,application/zip"
        aria-label="Save zip"
        className="absolute size-px opacity-0"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (chosen) onFile(chosen);
        }}
      />
    </label>
  );
}

function FileRow({ file, step }: { file: File; step: Step }) {
  const uploading = step.name === "uploading";
  const failed = step.name === "uploadFailed";
  const progress = uploading || failed ? step.progress : 1;
  const percent = Math.round(progress * 100);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-box px-4 py-3.5">
      <div className="flex items-center gap-3.5">
        <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-lg bg-ink">
          <PixelIcon name="zip" className="size-6 text-primary" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold">{file.name}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{size(file.size)}</span>
        </span>
        <span
          className={cn(
            "flex flex-none items-center gap-2 font-heading text-2xl tabular-nums",
            uploading ? "text-foreground" : failed ? "text-destructive" : "text-chart-2",
          )}
        >
          {!uploading && !failed && <PixelIcon name="check" className="size-4.5" />}
          {uploading ? `${percent}%` : failed ? "Failed" : "Uploaded"}
        </span>
      </div>
      {(uploading || failed) && (
        <span
          role="progressbar"
          aria-label="Upload"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="relative block h-4 overflow-hidden rounded-sm bg-ink"
        >
          <span
            className={cn("absolute inset-y-0 left-0 transition-[width] duration-140 ease-[steps(2)]", failed ? "bg-destructive" : "bg-primary")}
            style={{ width: `${percent}%` }}
          />
          <span aria-hidden="true" className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_14px,var(--ink)_14px_17px)]" />
        </span>
      )}
    </div>
  );
}

function RolledZip({ saved, onDownload }: { saved: SavedSnapshot; onDownload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await onDownload();
    } catch (caught) {
      setError(message(caught));
    }
    setBusy(false);
  }

  return (
    <div className="mt-2 flex flex-col gap-2 self-stretch">
      <div className="flex items-center gap-3.5 rounded-2xl bg-box py-3 pr-3 pl-4">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-heading text-2xl leading-none tabular-nums">
            {saved.rolled} TM {saved.rolled === 1 ? "roll" : "rolls"}
          </span>
          <span className="truncate text-sm text-muted-foreground">{saved.sideFile}</span>
        </span>
        <button type="button" disabled={busy} onClick={() => void download()} className={cn(buttonClass, "min-h-12 px-4 text-2xl")}>
          <PixelIcon name="download" className="size-4 text-primary" />
          Download zip
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive bg-destructive-soft px-4 py-3.5">
      <CircleAlert aria-hidden="true" className="mt-px size-5.5 flex-none text-destructive" />
      <span className="font-bold">{children}</span>
    </div>
  );
}
