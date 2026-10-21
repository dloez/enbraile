import { useState } from "react";
import { ClipboardPaste, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoredTeam } from "@/open-sheet/db";
import { iconButtonClass, Segmented } from "@/components/controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";

export type View = "pc" | "team";

const VIEWS: readonly { value: View; label: string }[] = [
  { value: "pc", label: "PC" },
  { value: "team", label: "Team" },
];

interface TeamBarProps {
  view: View;
  onView: (view: View) => void;
  teams: StoredTeam[];
  team: StoredTeam;
  onPick: (id: number) => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onPaste: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function TeamName({ team, onDone }: { team: StoredTeam; onDone: (name: string) => void }) {
  const [draft, setDraft] = useState(team.name);

  function commit() {
    const name = draft.trim();
    onDone(name === "" ? team.name : name);
  }

  return (
    <input
      autoFocus
      aria-label="Team name"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") onDone(team.name);
      }}
      className="min-h-10 w-48 rounded-lg border bg-card px-2.5 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
}

export function TeamBar({ view, onView, teams, team, onPick, onCreate, onDuplicate, onPaste, onRename, onDelete }: TeamBarProps) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Segmented label="View" options={VIEWS} value={view} onChange={onView} />
      {renaming ? (
        <TeamName
          team={team}
          onDone={(name) => {
            setRenaming(false);
            if (name !== team.name) onRename(name);
          }}
        />
      ) : (
        <label className="flex items-center">
          <span className="sr-only">Team</span>
          <select
            value={team.id}
            onChange={(event) => onPick(Number(event.target.value))}
            className="min-h-10 max-w-56 rounded-lg border bg-card px-2.5 font-semibold text-foreground"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" aria-label="New team" title="New team" onClick={onCreate} className={iconButtonClass}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Duplicate team" title="Duplicate team" onClick={onDuplicate} className={iconButtonClass}>
        <Copy className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Import from Showdown"
        title="Import from Showdown"
        onClick={onPaste}
        className={iconButtonClass}
      >
        <ClipboardPaste className="size-4" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Rename team" title="Rename team" onClick={() => setRenaming(true)} className={iconButtonClass}>
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Delete team"
        title="Delete team"
        onClick={() => setDeleting(true)}
        className={cn(iconButtonClass, "text-destructive")}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent aria-describedby={undefined} className="bg-card sm:max-w-sm">
          <DialogTitle className="font-heading text-lg font-bold">Delete {team.name}?</DialogTitle>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleting(false);
                onDelete();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
