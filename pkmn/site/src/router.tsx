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

const openSheetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/open-sheet",
  component: lazyRouteComponent(() => import("@/pages/open-sheet"), "OpenSheetPage"),
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
  openSheetRoute,
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
