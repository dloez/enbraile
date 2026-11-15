import type { MapPage, MapsPage, RunSheet } from "../shared/runs";
import { fetchMap, fetchMaps, fetchRun } from "./api";
import { place } from "./route";

export type Source<T> = { key: string; fetch: () => Promise<T> };

export const openFreshMs = 1000;
const pointFreshMs = 15000;

const pages = new Map<string, { page: unknown; at: number }>();
const flying = new Map<string, Promise<unknown>>();

export const mapsSource: Source<MapsPage> = { key: "maps", fetch: fetchMaps };
export const mapSource = (game: string, map: string): Source<MapPage> => ({ key: `map ${game}/${map}`, fetch: () => fetchMap(game, map) });
export const runSource = (id: string): Source<RunSheet> => ({ key: `run ${id}`, fetch: () => fetchRun(id) });

export function known<T>(source: Source<T>): T | undefined {
  return pages.get(source.key)?.page as T | undefined;
}

export function forget(source: Source<unknown>): void {
  pages.delete(source.key);
  flying.delete(source.key);
}

export function load<T>(source: Source<T>, freshMs: number): Promise<T> {
  const flight = flying.get(source.key);
  if (flight) return flight as Promise<T>;
  const entry = pages.get(source.key);
  if (entry && Date.now() - entry.at < freshMs) return Promise.resolve(entry.page as T);
  const fetching = source
    .fetch()
    .then((page) => {
      if (flying.get(source.key) === fetching) pages.set(source.key, { page, at: Date.now() });
      return page;
    })
    .finally(() => flying.get(source.key) === fetching && flying.delete(source.key));
  flying.set(source.key, fetching);
  return fetching;
}

export function prefetch(path: string): void {
  const to = place(path);
  const source = to.kind === "maps" ? mapsSource : to.kind === "map" ? mapSource(to.game, to.map) : runSource(to.id);
  load<unknown>(source, pointFreshMs).catch(() => undefined);
}
