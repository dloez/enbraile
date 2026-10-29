import { Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LoadingBar } from "@/components/loading-bar";
import { SiteHeader } from "@/components/site-header";
import { ApiError, api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { AdminSignInPage } from "@/pages/admin-sign-in";
import { SignInPage } from "@/pages/sign-in";
import { WaitingPage } from "@/pages/waiting";
import { messages } from "../../shared/i18n";
import { type OwedSeries, owedSeriesList } from "../../shared/series";

const t = messages({
  en: { loading: "Loading the site" },
  es: { loading: "Cargando la web" },
});

function askOwed() {
  return api("/series/owed", owedSeriesList).catch((error: unknown) => {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return api("/series/owed", owedSeriesList);
    throw error;
  });
}

function useOwed(playerId: string | null) {
  const [owed, setOwed] = useState<{ playerId: string; list: OwedSeries[] } | undefined>(undefined);
  const refresh = useCallback(() => {
    if (playerId === null) return;
    void askOwed().then(
      (list) => setOwed({ playerId, list }),
      () => setOwed({ playerId, list: [] }),
    );
  }, [playerId]);
  useEffect(refresh, [refresh]);
  return { owed: owed?.playerId === playerId ? owed.list : undefined, refresh };
}

export function SiteShell() {
  const { data, isPending } = authClient.useSession();
  const onAdmin = useRouterState({ select: (state) => state.location.pathname.startsWith("/admin") });
  const player = data && !data.user.admin && data.user.allowed ? data.user.id : null;
  const { owed, refresh } = useOwed(player);

  if (isPending || (!onAdmin && player !== null && owed === undefined)) return <LoadingBar label={t.loading} className="fixed top-0" />;
  if (onAdmin) {
    if (!data?.user.admin) return <AdminSignInPage />;
  } else {
    if (!data) return <SignInPage />;
    if (!data.user.admin && !data.user.allowed) return <WaitingPage player={data.user} />;
    if (owed && owed.length > 0) return <WaitingPage player={data.user} owed={owed} onUploaded={refresh} />;
  }

  return (
    <div className="flex min-h-(--screen-h) flex-col">
      <SiteHeader />
      <Outlet />
    </div>
  );
}
