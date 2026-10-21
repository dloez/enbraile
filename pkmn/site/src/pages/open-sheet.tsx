import { useMemo, useState, type DragEvent } from "react";
import { addImport, closeTab, renameTab, replaceImport, useOpenTabs, type OpenTab } from "@/open-sheet/db";
import { checkSheet, readSheet, type Checked } from "@/open-sheet/schema";
import { messageWidth, toolPage } from "@/components/page";
import { cn } from "@/lib/utils";
import { DropZone } from "@/open-sheet/components/drop-zone";
import { Pc } from "@/open-sheet/components/pc";
import { Refusal, type Refused } from "@/open-sheet/components/refusal";
import { TabBar } from "@/open-sheet/components/tab-bar";

type View = { kind: "import" } | { kind: "tab"; id: number };

const LAST_TAB = "open-sheet:tab";

function lastTab(): View | null {
  try {
    const id = Number(localStorage.getItem(LAST_TAB));
    return Number.isInteger(id) && id > 0 ? { kind: "tab", id } : null;
  } catch {
    return null;
  }
}

function rememberTab(id: number) {
  try {
    localStorage.setItem(LAST_TAB, String(id));
  } catch {
    return;
  }
}

function checkTab(tab: OpenTab): Checked {
  return tab.import ? checkSheet(tab.import.data) : { ok: false, reason: "is missing" };
}

function ImportView({ stale, onFiles }: { stale?: Refused; onFiles: (files: File[]) => void }) {
  return (
    <main className="flex flex-1 flex-col gap-4 py-10">
      {stale && <Refusal {...stale} />}
      <DropZone onFiles={onFiles} />
    </main>
  );
}

export function OpenSheetPage() {
  const tabs = useOpenTabs();
  const [view, setView] = useState<View | null>(lastTab);
  const [refused, setRefused] = useState<Refused[]>([]);

  const checks = useMemo(() => new Map((tabs ?? []).map((tab) => [tab.id, checkTab(tab)])), [tabs]);
  const staleIds = useMemo(
    () => new Set([...checks].filter(([, checked]) => !checked.ok).map(([id]) => id)),
    [checks],
  );

  if (tabs === null) {
    return (
      <main className={cn(toolPage, "py-10")}>
        <p role="alert" className={cn(messageWidth, "text-destructive")}>
          This browser will not let the site store imports.
        </p>
      </main>
    );
  }
  if (!tabs) return <main className={toolPage} />;

  const chosen = view?.kind === "tab" ? tabs.find((tab) => tab.id === view.id) : undefined;
  const active = view?.kind === "import" ? undefined : (chosen ?? tabs[0]);
  const activeCheck = active ? checks.get(active.id) : undefined;

  async function importFiles(files: File[], into?: OpenTab) {
    const refusals: Refused[] = [];
    let opened: number | undefined;
    for (const file of files) {
      const checked = readSheet(await file.text());
      if (!checked.ok) {
        refusals.push({ fileName: file.name, reason: checked.reason });
      } else if (into) {
        await replaceImport(into.importId, file.name, checked.sheet);
        opened = into.id;
        into = undefined;
      } else {
        opened = await addImport(file.name, checked.sheet);
      }
    }
    setRefused(refusals);
    if (opened !== undefined) {
      rememberTab(opened);
      setView({ kind: "tab", id: opened });
    }
  }

  function pageDrop(event: DragEvent) {
    event.preventDefault();
    void importFiles(Array.from(event.dataTransfer.files), activeCheck?.ok === false ? active : undefined);
  }

  function show(next: View) {
    if (next.kind === "tab") rememberTab(next.id);
    setRefused([]);
    setView(next);
  }

  return (
    <div className={toolPage} onDragOver={(event) => event.preventDefault()} onDrop={pageDrop}>
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeId={active?.id ?? null}
          staleIds={staleIds}
          onPick={(id) => show({ kind: "tab", id })}
          onRename={(id, name) => void renameTab(id, name)}
          onClose={(id) => {
            setRefused([]);
            void closeTab(id);
          }}
          onImport={() => show({ kind: "import" })}
        />
      )}
      {refused.length > 0 && (
        <div className="flex flex-col gap-4 pt-6">
          {refused.map((r, index) => (
            <Refusal key={index} {...r} />
          ))}
        </div>
      )}
      {active && activeCheck?.ok ? (
        <main className="flex flex-1 flex-col">
          <Pc key={active.id} tabId={active.id} sheet={activeCheck.sheet} />
        </main>
      ) : active && activeCheck ? (
        <ImportView
          stale={{
            fileName: active.import?.fileName ?? active.name,
            reason: `${activeCheck.ok ? "" : activeCheck.reason} and needs importing again`,
          }}
          onFiles={(files) => void importFiles(files, active)}
        />
      ) : (
        <ImportView onFiles={(files) => void importFiles(files)} />
      )}
    </div>
  );
}
