import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { prefetch } from "@/lib/api";
import { pcPage, playerSeriesPage, profilePage, seriesListPage, seriesPage, teamPage, teamsPage } from "@/lib/lazy-pages";
import { HomePage } from "@/pages/home";

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
  },
  component: seriesPage.Page,
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

export type PcSearch = { snapshot?: string };

const pcRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$player/series/$number/pc",
  validateSearch: (search: Record<string, unknown>): PcSearch =>
    typeof search.snapshot === "string" && search.snapshot !== "" ? { snapshot: search.snapshot } : {},
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    pcPage.load();
    prefetch(`/series/${encodeURIComponent(params.number)}/trainers/${encodeURIComponent(params.player)}/pc${deps.snapshot === undefined ? "" : `?snapshot=${encodeURIComponent(deps.snapshot)}`}`);
  },
  component: pcPage.Page,
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
  component: lazyRouteComponent(() => import("@/pages/admin"), "AdminPage"),
});

const adminGamesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/games",
  component: lazyRouteComponent(() => import("@/pages/admin-games"), "AdminGamesPage"),
});

const adminPlayersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/players",
  component: lazyRouteComponent(() => import("@/pages/admin-players"), "AdminPlayersPage"),
});

const adminSeriesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/series",
  component: lazyRouteComponent(() => import("@/pages/admin-series-list"), "AdminSeriesListPage"),
});

const adminSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/series/$id",
  component: lazyRouteComponent(() => import("@/pages/admin-series"), "AdminSeriesPage"),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  seriesListRoute,
  seriesRoute,
  playerProfileRoute,
  playerSeriesRoute,
  pcRoute,
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
