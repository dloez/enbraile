import { useState } from "react";
import { readShowdownTeam, type AnyPokemon } from "@/teams/showdown";
import type { Slots, Stocks } from "@/teams/team";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";

interface PasteDialogProps {
  stocks: Stocks;
  any: AnyPokemon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (slots: Slots) => Promise<string>;
  onOpen: (team: string) => void;
}

interface Outcome {
  added: number;
  free: string[];
  left: string[];
  made: string | null;
}

export function PasteDialog({ stocks, any, open, onOpenChange, onImport, onOpen }: PasteDialogProps) {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    if (!next) {
      const made = outcome?.made ?? null;
      setText("");
      setOutcome(null);
      setError(null);
      if (made) onOpen(made);
    }
    onOpenChange(next);
  }

  async function submit() {
    const read = readShowdownTeam(text, stocks, any);
    setError(null);
    if (read.added === 0) {
      setOutcome({ ...read, made: null });
      return;
    }
    setBusy(true);
    try {
      const made = await onImport(read.slots);
      if (read.left.length === 0 && read.free.length === 0) {
        setText("");
        onOpenChange(false);
        onOpen(made);
      } else setOutcome({ ...read, made });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const done = outcome !== null && outcome.made !== null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent aria-describedby={undefined} className="bg-card sm:max-w-lg">
        <DialogTitle className="font-heading text-2xl">Paste from Showdown</DialogTitle>
        {!done && (
          <textarea
            autoFocus
            aria-label="Showdown team"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setOutcome(null);
            }}
            rows={12}
            spellCheck={false}
            className="min-h-60 w-full resize-y rounded-lg border bg-muted p-2.5 tabular-nums text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        )}
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
        {outcome && (
          <div role="status" className="flex flex-col gap-1.5 text-sm">
            <p className="m-0 font-semibold">
              {outcome.added > 0 ? `Imported ${outcome.added} Pokémon into a new team.` : outcome.left.length > 0 ? "Nothing to import:" : "Nothing to import."}
            </p>
            {outcome.free.length > 0 && (
              <>
                <p className="m-0 font-semibold">As free members:</p>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-subtle">
                  {outcome.free.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </>
            )}
            {outcome.added > 0 && outcome.left.length > 0 && <p className="m-0 font-semibold">Left out:</p>}
            {outcome.left.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-destructive">
                {outcome.left.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={() => close(false)}>Open the team</Button>
          ) : (
            <>
              <Button onClick={() => close(false)}>
                Cancel
              </Button>
              <Button disabled={text.trim() === "" || busy} onClick={() => void submit()}>
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
