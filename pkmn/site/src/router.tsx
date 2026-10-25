import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
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
  component: lazyRouteComponent(() => import("@/pages/series-list"), "SeriesListPage"),
});

const seriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/series/$number",
  component: lazyRouteComponent(() => import("@/pages/series"), "SeriesPage"),
});

const playerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$player",
  component: lazyRouteComponent(() => import("@/pages/player-profile"), "PlayerProfilePage"),
});

const playerSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$player/series/$number",
  component: lazyRouteComponent(() => import("@/pages/player-series"), "PlayerSeriesPage"),
});

export type PcSearch = { snapshot?: string };

const pcRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/players/$player/series/$number/pc",
  validateSearch: (search: Record<string, unknown>): PcSearch =>
    typeof search.snapshot === "string" && search.snapshot !== "" ? { snapshot: search.snapshot } : {},
  component: lazyRouteComponent(() => import("@/pages/pc"), "PcPage"),
});

const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams",
  component: lazyRouteComponent(() => import("@/pages/teams"), "TeamsPage"),
});

const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$id",
  component: lazyRouteComponent(() => import("@/pages/team"), "TeamBuilderPage"),
});

const teamAnalysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/team-analysis",
  component: lazyRouteComponent(() => import("@/pages/team-analysis"), "TeamAnalysisPage"),
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
  teamAnalysisRoute,
  adminRoute,
  adminGamesRoute,
  adminPlayersRoute,
  adminSeriesListRoute,
  adminSeriesRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
