import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { HomePage } from "@/pages/home";

const rootRoute = createRootRoute({ component: SiteShell });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
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

const routeTree = rootRoute.addChildren([homeRoute, openSheetRoute, teamAnalysisRoute, adminRoute, adminGamesRoute, adminPlayersRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
