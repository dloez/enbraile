import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { AdminPage } from "@/pages/admin";
import { AdminGamesPage } from "@/pages/admin-games";
import { HomePage } from "@/pages/home";
import { OpenSheetPage } from "@/pages/open-sheet";
import { TeamAnalysisPage } from "@/pages/team-analysis";

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <Outlet />
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const openSheetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/open-sheet",
  component: OpenSheetPage,
});

const teamAnalysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/team-analysis",
  component: TeamAnalysisPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const adminGamesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/games",
  component: AdminGamesPage,
});

const routeTree = rootRoute.addChildren([homeRoute, openSheetRoute, teamAnalysisRoute, adminRoute, adminGamesRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
