import { Dexie, liveQuery, type EntityTable } from "dexie";
import { useEffect, useState } from "react";
import { tabName } from "@/open-sheet/schema";

export interface StoredImport {
  id: number;
  fileName: string;
  importedAt: number;
  data: unknown;
}

export interface StoredTab {
  id: number;
  importId: number;
  name: string;
  position: number;
}

export const db = new Dexie("open-sheet") as Dexie & {
  imports: EntityTable<StoredImport, "id">;
  tabs: EntityTable<StoredTab, "id">;
};

db.version(1).stores({
  imports: "++id",
  tabs: "++id, importId, position",
});

export async function addImport(fileName: string, data: unknown): Promise<number> {
  return db.transaction("rw", db.imports, db.tabs, async () => {
    const importId = await db.imports.add({ fileName, importedAt: Date.now(), data });
    const last = await db.tabs.orderBy("position").last();
    return db.tabs.add({ importId, name: tabName(fileName), position: (last?.position ?? 0) + 1 });
  });
}

export async function replaceImport(importId: number, fileName: string, data: unknown): Promise<void> {
  await db.imports.put({ id: importId, fileName, importedAt: Date.now(), data });
}

export async function renameTab(id: number, name: string): Promise<void> {
  await db.tabs.update(id, { name });
}

export async function closeTab(id: number): Promise<void> {
  await db.transaction("rw", db.imports, db.tabs, async () => {
    const tab = await db.tabs.get(id);
    if (!tab) return;
    await db.tabs.delete(id);
    await db.imports.delete(tab.importId);
  });
}

export interface OpenTab extends StoredTab {
  import: StoredImport | undefined;
}

async function loadTabs(): Promise<OpenTab[]> {
  const tabs = await db.tabs.orderBy("position").toArray();
  const imports = await db.imports.bulkGet(tabs.map((tab) => tab.importId));
  return tabs.map((tab, index) => ({ ...tab, import: imports[index] }));
}

export function useOpenTabs(): OpenTab[] | null | undefined {
  const [tabs, setTabs] = useState<OpenTab[] | null>();
  useEffect(() => {
    const subscription = liveQuery(loadTabs).subscribe({ next: setTabs, error: () => setTabs(null) });
    return () => subscription.unsubscribe();
  }, []);
  return tabs;
}
