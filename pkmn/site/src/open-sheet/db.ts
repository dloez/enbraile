import { Dexie, liveQuery, type EntityTable } from "dexie";
import { useEffect, useState } from "react";
import { tabName } from "@/open-sheet/schema";
import { emptySlots, nextTeamName, type Slots } from "@/open-sheet/team";

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

export interface StoredTeam {
  id: number;
  tabId: number;
  name: string;
  slots: Slots;
}

export const db = new Dexie("open-sheet") as Dexie & {
  imports: EntityTable<StoredImport, "id">;
  tabs: EntityTable<StoredTab, "id">;
  teams: EntityTable<StoredTeam, "id">;
};

db.version(1).stores({
  imports: "++id",
  tabs: "++id, importId, position",
});

db.version(2).stores({
  teams: "++id, tabId",
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
  await db.transaction("rw", db.imports, db.tabs, db.teams, async () => {
    const tab = await db.tabs.get(id);
    if (!tab) return;
    await db.tabs.delete(id);
    await db.imports.delete(tab.importId);
    await db.teams.where("tabId").equals(id).delete();
  });
}

async function teamNames(tabId: number): Promise<string[]> {
  return (await db.teams.where("tabId").equals(tabId).toArray()).map((team) => team.name);
}

export async function ensureTeam(tabId: number): Promise<void> {
  await db.transaction("rw", db.teams, async () => {
    if ((await db.teams.where("tabId").equals(tabId).count()) > 0) return;
    await db.teams.add({ tabId, name: nextTeamName([]), slots: emptySlots() });
  });
}

export async function createTeam(tabId: number): Promise<number> {
  return db.transaction("rw", db.teams, async () =>
    db.teams.add({ tabId, name: nextTeamName(await teamNames(tabId)), slots: emptySlots() }),
  );
}

export async function duplicateTeam(id: number): Promise<number | undefined> {
  return db.transaction("rw", db.teams, async () => {
    const team = await db.teams.get(id);
    if (!team) return undefined;
    return db.teams.add({ tabId: team.tabId, name: `${team.name} copy`, slots: team.slots });
  });
}

export async function renameTeam(id: number, name: string): Promise<void> {
  await db.teams.update(id, { name });
}

export async function saveSlots(id: number, slots: Slots): Promise<void> {
  await db.teams.update(id, { slots });
}

export async function deleteTeam(id: number): Promise<void> {
  await db.teams.delete(id);
}

export interface OpenTab extends StoredTab {
  import: StoredImport | undefined;
}

async function loadTabs(): Promise<OpenTab[]> {
  const tabs = await db.tabs.orderBy("position").toArray();
  const imports = await db.imports.bulkGet(tabs.map((tab) => tab.importId));
  return tabs.map((tab, index) => ({ ...tab, import: imports[index] }));
}

function useLive<T>(query: () => Promise<T>, deps: readonly unknown[]): T | null | undefined {
  const [value, setValue] = useState<T | null>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({ next: setValue, error: () => setValue(null) });
    return () => subscription.unsubscribe();
  }, deps);
  return value;
}

export function useOpenTabs(): OpenTab[] | null | undefined {
  return useLive(loadTabs, []);
}

export function useTeams(tabId: number): StoredTeam[] | null | undefined {
  const teams = useLive(() => db.teams.where("tabId").equals(tabId).sortBy("id"), [tabId]);
  useEffect(() => {
    if (teams?.length === 0) void ensureTeam(tabId);
  }, [teams, tabId]);
  return teams;
}
