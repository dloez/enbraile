import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { prefetch } from "@/lib/api";
import { abilitiesPage, adminGamesPage, adminHomePage, adminPlayersPage, adminSeriesListPage, adminSeriesPage, leaguePage, pcPage, playerSeriesPage, profilePage, seriesListPage, seriesPage, teamPage, teamsPage } from "@/lib/lazy-pages";
import { HomePage } from "@/pages/home";
import type { LeagueView } from "@/pages/league";

const rootRoute = createRootRoute({ component: SiteShell });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const seriesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/series",
  loader: () => {
    seriesListPage.load();
    prefetch("/series");
  },
  component: seriesListPage.Page,
});

const seriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/series/$number",
  loader: ({ params }) => {
    seriesPage.load();
    prefetch(`/series/${encodeURIComponent(params.number)}`);
    prefetch(`/series/${encodeURIComponent(params.number)}/league`);
  },
  component: seriesPage.Page,
});

export type LeagueSearch = { view?: Exclude<LeagueView, "overview"> };

const leagueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/series/$number/league",
  validateSearch: (search: Record<string, unknown>): LeagueSearch => (search.view === "rounds" ? { view: "rounds" } : {}),
  loader: ({ params }) => {
    leaguePage.load();
    prefetch(`/series/${encodeURIComponent(params.number)}/league`);
  },
  component: leaguePage.Page,
});

const playerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$player",
  loader: ({ params }) => {
    profilePage.load();
    prefetch(`/profiles/${encodeURIComponent(params.player)}`);
  },
  component: profilePage.Page,
});

const playerSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$player/series/$number",
  loader: ({ params }) => {
    playerSeriesPage.load();
    prefetch(`/series/${encodeURIComponent(params.number)}/trainers/${encodeURIComponent(params.player)}/journey`);
  },
  component: playerSeriesPage.Page,
});

export type PcSearch = { snapshot?: string; mon?: number };

const pcRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$player/series/$number/pc",
  validateSearch: (search: Record<string, unknown>): PcSearch => ({
    ...(typeof search.snapshot === "string" && search.snapshot !== "" ? { snapshot: search.snapshot } : {}),
    ...(typeof search.mon === "number" && Number.isInteger(search.mon) && search.mon >= 0 ? { mon: search.mon } : {}),
  }),
  loaderDeps: ({ search }) => ({ snapshot: search.snapshot }),
  loader: ({ params, deps }) => {
    pcPage.load();
    prefetch(`/series/${encodeURIComponent(params.number)}/trainers/${encodeURIComponent(params.player)}/pc${deps.snapshot === undefined ? "" : `?snapshot=${encodeURIComponent(deps.snapshot)}`}`);
  },
  component: pcPage.Page,
});

export type AbilitiesSearch = { ability?: string };

const abilitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/series/$number/abilities",
  validateSearch: (search: Record<string, unknown>): AbilitiesSearch =>
    typeof search.ability === "string" && search.ability !== "" ? { ability: search.ability } : {},
  loader: ({ params }) => {
    abilitiesPage.load();
    prefetch(`/series/${encodeURIComponent(params.number)}/abilities`);
  },
  component: abilitiesPage.Page,
});

export type TeamsSearch = { player?: string };

const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams",
  validateSearch: (search: Record<string, unknown>): TeamsSearch =>
    typeof search.player === "string" && search.player !== "" ? { player: search.player } : {},
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => {
    teamsPage.load();
    prefetch(deps.player ? `/teams?owner=${encodeURIComponent(deps.player)}` : "/teams");
  },
  component: teamsPage.Page,
});

const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$id",
  loader: ({ params }) => {
    teamPage.load();
    prefetch(`/teams/${encodeURIComponent(params.id)}`);
  },
  component: teamPage.Page,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  loader: () => {
    adminHomePage.load();
    for (const path of ["/admin/series", "/players", "/games"]) prefetch(path);
  },
  component: adminHomePage.Page,
});

const adminGamesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/games",
  loader: () => {
    adminGamesPage.load();
    for (const path of ["/games", "/admin/series", "/players"]) prefetch(path);
  },
  component: adminGamesPage.Page,
});

const adminPlayersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/players",
  loader: () => {
    adminPlayersPage.load();
    for (const path of ["/players"]) prefetch(path);
  },
  component: adminPlayersPage.Page,
});

const adminSeriesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/series",
  loader: () => {
    adminSeriesListPage.load();
    for (const path of ["/admin/series", "/games", "/players"]) prefetch(path);
  },
  component: adminSeriesListPage.Page,
});

const adminSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/series/$id",
  loader: ({ params }) => {
    adminSeriesPage.load();
    for (const path of [`/admin/series/${encodeURIComponent(params.id)}`, "/games", "/players", "/admin/series"]) prefetch(path);
  },
  component: adminSeriesPage.Page,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  seriesListRoute,
  seriesRoute,
  leagueRoute,
  playerProfileRoute,
  playerSeriesRoute,
  pcRoute,
  abilitiesRoute,
  teamsRoute,
  teamRoute,
  adminRoute,
  adminGamesRoute,
  adminPlayersRoute,
  adminSeriesListRoute,
  adminSeriesRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: "intent", defaultPreloadStaleTime: 0 });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
