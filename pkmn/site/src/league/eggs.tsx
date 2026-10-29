import { useState } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { locale, messages } from "../../shared/i18n";
import { type HatchedEggs, type LeaguePage, leaguePage } from "../../shared/league";
import { overrideDone } from "../../shared/series";

const t = messages({
  en: {
    failed: "Something went wrong",
    eggs: (n: number) => `${n} ${n === 1 ? "egg" : "eggs"}`,
    hatched: (n: number) => `${n} hatched`,
    by: (name: string) => `by ${name}`,
    setTitle: (by: string, at: string, saved: number | null) => `Set by ${by}, ${at}. ${saved === null ? "No save yet." : `The save counts ${saved}.`}`,
    fromSave: "Counted from the latest save",
    noSave: "No save yet",
    pen: "Set hatched eggs",
    penLabel: (name: string) => `Set ${name}'s hatched eggs`,
    title: (name: string) => `Hatched eggs · ${name}`,
    setNote: (by: string, at: string, saved: number | null) => `Set by ${by}, ${at} · ${saved === null ? "no save yet" : `the save counts ${saved}`}`,
    saveNote: (n: number) => `Counted from the latest save: ${n}`,
    fewer: "One fewer",
    more: "One more",
    count: (name: string) => `Hatched eggs for ${name}`,
    ofWon: (n: number) => `of ${n} won`,
    useSave: "Use the save's count",
    cancel: "Cancel",
    save: "Save",
  },
  es: {
    failed: "Algo ha fallado",
    eggs: (n: number) => `${n} ${n === 1 ? "huevo" : "huevos"}`,
    hatched: (n: number) => `${n} ${n === 1 ? "eclosionado" : "eclosionados"}`,
    by: (name: string) => `por ${name}`,
    setTitle: (by: string, at: string, saved: number | null) =>
      `Puesto por ${by}, ${at}. ${saved === null ? "Aún sin partida." : `La partida cuenta ${saved}.`}`,
    fromSave: "Contados de la última partida",
    noSave: "Aún sin partida",
    pen: "Poner huevos eclosionados",
    penLabel: (name: string) => `Poner los huevos eclosionados de ${name}`,
    title: (name: string) => `Huevos eclosionados · ${name}`,
    setNote: (by: string, at: string, saved: number | null) => `Puesto por ${by}, ${at} · ${saved === null ? "aún sin partida" : `la partida cuenta ${saved}`}`,
    saveNote: (n: number) => `Contados de la última partida: ${n}`,
    fewer: "Uno menos",
    more: "Uno más",
    count: (name: string) => `Huevos eclosionados de ${name}`,
    ofWon: (n: number) => `de ${n} ganados`,
    useSave: "Usar la cuenta de la partida",
    cancel: "Cancelar",
    save: "Guardar",
  },
});

function when(at: string): string {
  return new Date(at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : t.failed;
}

function title(eggs: HatchedEggs): string {
  if (eggs.set) return t.setTitle(eggs.set.by, when(eggs.set.at), eggs.saved);
  return eggs.saved === null ? t.noSave : t.fromSave;
}

function Hatched({ eggs }: { eggs: HatchedEggs }) {
  return (
    <span className={cn("flex items-center gap-0.75", eggs.set ? "text-warning" : "text-muted-foreground")}>
      {eggs.set && <PixelIcon name="pencil" className="size-2.25" />}
      {t.hatched(eggs.count)}
    </span>
  );
}

export function EggsCell({ won, eggs }: { won: number; eggs: HatchedEggs }) {
  return (
    <span title={title(eggs)} className="flex flex-col items-center leading-none">
      <span className="font-heading text-[1.625rem]">{won}</span>
      <span className="text-xs font-bold">
        <Hatched eggs={eggs} />
      </span>
      {eggs.set && <span className="mt-0.5 text-[0.6875rem] text-muted-foreground">{t.by(eggs.set.by)}</span>}
    </span>
  );
}

export function EggsLine({ won, eggs }: { won: number; eggs: HatchedEggs }) {
  return (
    <span title={title(eggs)} className="flex items-center gap-1 font-heading text-[1.0625rem] whitespace-nowrap text-muted-foreground">
      {t.eggs(won)} ·
      <Hatched eggs={eggs} />
      {eggs.set && <span className="font-sans text-[0.6875rem] font-bold">{t.by(eggs.set.by)}</span>}
    </span>
  );
}

export function EggsPen({ name, open, onClick, size }: { name: string; open: boolean; onClick: () => void; size: "sm" | "lg" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.penLabel(name)}
      aria-expanded={open}
      title={t.pen}
      className={cn(
        "grid flex-none cursor-pointer place-items-center border-2 p-0 text-subtle outline-none hover:border-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50",
        size === "sm" ? "size-8 rounded-[7px]" : "size-11 rounded-lg",
        open ? "border-primary bg-row-hi" : "border-cell-hi bg-transparent",
      )}
    >
      <PixelIcon name="pencil" className={size === "sm" ? "size-3.5" : "size-4"} />
    </button>
  );
}

export function EggsEditor({
  number,
  player,
  name,
  won,
  eggs,
  onDone,
  onClose,
}: {
  number: number;
  player: string;
  name: string;
  won: number;
  eggs: HatchedEggs;
  onDone: (league: LeaguePage) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(eggs.count);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fix = (value: number) => Math.max(0, Math.min(won, value));
  const path = `/series/${number}/trainers/${encodeURIComponent(player)}/hatched`;
  const label = `hatch-label-${player}`;

  const send = async (init: { method: string; body?: unknown }) => {
    setBusy(true);
    setError(null);
    try {
      await api(path, overrideDone, init);
      onDone(await api(`/series/${number}/league`, leaguePage));
      onClose();
    } catch (caught) {
      setError(message(caught));
      setBusy(false);
    }
  };

  const save = () => {
    if (!eggs.set && draft === eggs.count) return onClose();
    void send({ method: "PUT", body: { count: draft } });
  };

  const step = "h-12 w-12 cursor-pointer border-none bg-transparent font-heading text-[1.75rem] text-white outline-none hover:bg-row-hi focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-default disabled:text-cell-hi disabled:hover:bg-transparent sm:h-11 sm:w-11";

  return (
    <div role="row" className="border-t-3 border-dashed bg-box">
      <div role="cell" className="flex flex-col gap-3 px-3 pt-3.5 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-3.5 sm:pt-4 sm:pr-5 sm:pb-4.5 sm:pl-18">
        <span className="flex min-w-45 flex-col gap-0.5">
          <span id={label} className="font-heading text-2xl leading-none">
            {t.title(name)}
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">{eggs.set ? t.setNote(eggs.set.by, when(eggs.set.at), eggs.saved) : eggs.saved === null ? t.noSave : t.saveNote(eggs.saved)}</span>
        </span>
        <span className="flex items-center gap-3 sm:contents">
          <span role="group" aria-labelledby={label} className="flex items-stretch overflow-hidden rounded-[10px] border-3 bg-ink">
            <button type="button" className={step} aria-label={t.fewer} disabled={busy || draft <= 0} onClick={() => setDraft(fix(draft - 1))}>
              −
            </button>
            <label className="flex">
              <span className="sr-only">{t.count(name)}</span>
              <input
                type="number"
                min={0}
                max={won}
                value={draft}
                disabled={busy}
                onChange={(event) => setDraft(fix(Number(event.target.value) || 0))}
                className="h-12 w-15 border-x-3 border-y-0 bg-ink text-center font-heading text-[1.75rem] text-white outline-none [appearance:textfield] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:h-11 sm:w-14 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
            <button type="button" className={step} aria-label={t.more} disabled={busy || draft >= won} onClick={() => setDraft(fix(draft + 1))}>
              +
            </button>
          </span>
          <span className="text-[0.8125rem] font-bold text-muted-foreground">{t.ofWon(won)}</span>
        </span>
        <span aria-hidden="true" className="hidden flex-1 sm:block" />
        <span className="flex flex-wrap gap-2 sm:contents">
          {eggs.set && (
            <Button type="button" disabled={busy} onClick={() => void send({ method: "DELETE" })} className="min-h-12 basis-full px-3.5 text-[1.375rem] sm:min-h-11 sm:basis-auto">
              {t.useSave}
            </Button>
          )}
          <Button type="button" disabled={busy} onClick={onClose} className="min-h-12 flex-1 px-3.5 text-[1.375rem] sm:min-h-11 sm:flex-none">
            {t.cancel}
          </Button>
          <Button type="button" variant="go" disabled={busy} onClick={save} className="min-h-12 flex-1 px-4.5 text-[1.375rem] sm:min-h-11 sm:flex-none">
            {t.save}
          </Button>
        </span>
        {error && (
          <p role="alert" className="m-0 basis-full text-sm font-bold text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
