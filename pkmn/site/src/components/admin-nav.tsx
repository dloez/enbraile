import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { messages } from "../../shared/i18n";
import { playerList } from "../../shared/players";

const t = messages({
  en: { overview: "Overview", series: "Series", players: "Players", games: "Games", pages: "Admin pages", waiting: ", waiting: " },
  es: { overview: "Resumen", series: "Series", players: "Jugadores", games: "Juegos", pages: "Páginas de admin", waiting: ", en espera: " },
});

const PAGES = [
  { name: t.overview, to: "/admin", exact: true },
  { name: t.series, to: "/admin/series", exact: false },
  { name: t.players, to: "/admin/players", exact: false },
  { name: t.games, to: "/admin/games", exact: false },
] as const;

function useWaiting(known: number | undefined): number | null {
  const [fetched, setFetched] = useState<number | null>(null);
  useEffect(() => {
    if (known !== undefined) return;
    let live = true;
    api("/players", playerList).then(
      (players) => live && setFetched(players.filter((p) => !p.allowed).length),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [known]);
  return known ?? fetched;
}

export function AdminNav({ waiting, className }: { waiting?: number; className?: string }) {
  const count = useWaiting(waiting);
  return (
    <nav
      aria-label={t.pages}
      className={cn("grid grid-cols-4 gap-0.75 rounded-xl border-3 bg-ink p-0.75 sm:flex sm:gap-1 sm:self-start sm:p-1", className)}
    >
      {PAGES.map((page) => (
        <Link
          key={page.to}
          to={page.to}
          activeOptions={{ exact: page.exact }}
          className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg font-heading text-[1.3125rem] text-muted-foreground outline-none hover:bg-card hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-cell aria-[current=page]:text-white sm:px-4 sm:text-[1.4375rem]"
        >
          {page.name}
          {page.to === "/admin/players" && count !== null && count > 0 && (
            <span className="min-w-4.5 rounded-full bg-yellow px-1.25 text-center text-base leading-4.5 text-ink sm:min-w-5.5 sm:px-1.5 sm:text-[1.1875rem] sm:leading-5.5">
              <span className="sr-only">{t.waiting}</span>
              {count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
