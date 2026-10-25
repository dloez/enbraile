import { useEffect, useState, type ComponentType } from "react";
import { PcFrame, PlayerSeriesFrame, ProfileFrame, SeriesFrame, SeriesListFrame, TeamFrame, TeamsFrame } from "@/components/page-frames";

function lazyPage(load: () => Promise<ComponentType>, Frame: ComponentType) {
  let loaded: ComponentType | null = null;
  let loading: Promise<ComponentType> | null = null;
  const start = () => (loading ??= load().then((component) => (loaded = component)));
  function Page() {
    const [Component, setComponent] = useState(() => loaded);
    useEffect(() => {
      if (!Component) void start().then((component) => setComponent(() => component));
    }, [Component]);
    return Component ? <Component /> : <Frame />;
  }
  return { Page, load: () => void start() };
}

export const seriesListPage = lazyPage(() => import("@/pages/series-list").then((m) => m.SeriesListPage), SeriesListFrame);
export const seriesPage = lazyPage(() => import("@/pages/series").then((m) => m.SeriesPage), SeriesFrame);
export const profilePage = lazyPage(() => import("@/pages/player-profile").then((m) => m.PlayerProfilePage), ProfileFrame);
export const playerSeriesPage = lazyPage(() => import("@/pages/player-series").then((m) => m.PlayerSeriesPage), PlayerSeriesFrame);
export const pcPage = lazyPage(() => import("@/pages/pc").then((m) => m.PcPage), PcFrame);
export const teamsPage = lazyPage(() => import("@/pages/teams").then((m) => m.TeamsPage), TeamsFrame);
export const teamPage = lazyPage(() => import("@/pages/team").then((m) => m.TeamBuilderPage), TeamFrame);
