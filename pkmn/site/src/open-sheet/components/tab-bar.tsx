import { useState } from "react";
import { CircleAlert, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpenTab } from "@/open-sheet/db";

interface TabBarProps {
  tabs: OpenTab[];
  activeId: number | null;
  staleIds: ReadonlySet<number>;
  onPick: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onClose: (id: number) => void;
  onImport: () => void;
}

const iconButton =
  "grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-cell hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

function TabName({ tab, onRename }: { tab: OpenTab; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(tab.name);

  function commit() {
    const name = draft.trim();
    onRename(name === "" ? tab.name : name);
  }

  return (
    <input
      autoFocus
      aria-label="Tab name"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") onRename(tab.name);
      }}
      className="w-36 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
}

export function TabBar({ tabs, activeId, staleIds, onPick, onRename, onClose, onImport }: TabBarProps) {
  const [renaming, setRenaming] = useState<number | null>(null);

  return (
    <nav
      aria-label="Imported sheets"
      className="flex flex-none items-end gap-1 overflow-x-auto border-b px-4 pt-2 sm:px-8"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const stale = staleIds.has(tab.id);
        return (
          <div
            key={tab.id}
            className={cn(
              "-mb-px flex flex-none items-center gap-1 rounded-t-[10px] border border-b-0",
              active ? "border-border bg-background" : "border-transparent",
            )}
          >
            {active && renaming === tab.id ? (
              <span className="py-1.5 pl-2">
                <TabName
                  tab={tab}
                  onRename={(name) => {
                    setRenaming(null);
                    if (name !== tab.name) onRename(tab.id, name);
                  }}
                />
              </span>
            ) : (
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onPick(tab.id)}
                onDoubleClick={() => setRenaming(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 py-2.25 pl-3.5 font-mono text-[13px] font-medium outline-none focus-visible:underline",
                  active ? "pr-1 text-foreground" : "pr-3.5 text-muted-foreground hover:text-foreground",
                )}
              >
                {stale && <CircleAlert className="size-3.5 text-destructive" aria-label="Needs importing again" />}
                {tab.name}
              </button>
            )}
            {active && (
              <span className="flex items-center gap-0.5 pr-1.5">
                {renaming !== tab.id && (
                  <button type="button" aria-label="Rename tab" title="Rename tab" onClick={() => setRenaming(tab.id)} className={iconButton}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                )}
                <button type="button" aria-label="Close tab" title="Close tab" onClick={() => onClose(tab.id)} className={iconButton}>
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        );
      })}
      <button
        type="button"
        aria-label="Import a file"
        title="Import a file"
        aria-current={activeId === null ? "page" : undefined}
        onClick={onImport}
        className="mb-0.75 grid h-9 w-10 flex-none place-items-center text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
      >
        <Plus className="size-4.5" strokeWidth={2.2} aria-hidden="true" />
      </button>
    </nav>
  );
}
