import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { HomePage } from "@/pages/home";
import { OpenSheetPage } from "@/pages/open-sheet";

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
  staticData: { title: "Open Sheet" },
  component: OpenSheetPage,
});

const routeTree = rootRoute.addChildren([homeRoute, openSheetRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    title?: string;
  }
}
