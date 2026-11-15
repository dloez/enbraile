import { useEffect, useState } from "react";

export function navigate(path: string): void {
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
  scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  return path;
}

export const runPath = (id: string) => `/attempts/${encodeURIComponent(id)}`;
export const mapPath = (game: string, map: string) => `/maps/${encodeURIComponent(game)}/${encodeURIComponent(map)}`;

export type Place = { kind: "maps" } | { kind: "map"; game: string; map: string } | { kind: "run"; id: string };

export function place(path: string): Place {
  const run = path.match(/^\/attempts\/([^/]+)\/?$/);
  if (run) return { kind: "run", id: decodeURIComponent(run[1]!) };
  const map = path.match(/^\/maps\/([^/]+)\/([^/]+)\/?$/);
  if (map) return { kind: "map", game: decodeURIComponent(map[1]!), map: decodeURIComponent(map[2]!) };
  return { kind: "maps" };
}
