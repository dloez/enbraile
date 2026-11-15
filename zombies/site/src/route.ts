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

export const runPath = (id: string) => `/runs/${encodeURIComponent(id)}`;
export const mapPath = (game: string, map: string) => `/maps/${encodeURIComponent(game)}/${encodeURIComponent(map)}`;
