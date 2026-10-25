import { useState } from "react";
import { readShowdownTeam } from "@/teams/showdown";
import type { Slots, Stocks } from "@/teams/team";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";

interface PasteDialogProps {
  stocks: Stocks;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (slots: Slots) => Promise<void>;
}

interface Outcome {
  added: number;
  left: string[];
}

export function PasteDialog({ stocks, open, onOpenChange, onImport }: PasteDialogProps) {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function close(next: boolean) {
    if (!next) {
      setText("");
      setOutcome(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    const read = readShowdownTeam(text, stocks);
    if (read.added > 0) await onImport(read.slots);
    if (read.added > 0 && read.left.length === 0) close(false);
    else setOutcome({ added: read.added, left: read.left });
  }

  const done = outcome !== null && outcome.added > 0;

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
        {outcome && (
          <div role="status" className="flex flex-col gap-1.5 text-sm">
            <p className="m-0 font-semibold">
              {outcome.added > 0
                ? `Imported ${outcome.added} Pokémon into a new team. Left out:`
                : outcome.left.length > 0
                  ? "Nothing to import:"
                  : "Nothing to import."}
            </p>
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
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button onClick={() => close(false)}>
                Cancel
              </Button>
              <Button disabled={text.trim() === ""} onClick={() => void submit()}>
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
