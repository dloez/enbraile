import { Outlet, useRouterState } from "@tanstack/react-router";
import { LoadingBar } from "@/components/loading-bar";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";
import { SignInPage } from "@/pages/sign-in";
import { WaitingPage } from "@/pages/waiting";

export function SiteShell() {
  const { data, isPending } = authClient.useSession();
  const onAdmin = useRouterState({ select: (state) => state.location.pathname.startsWith("/admin") });

  if (!onAdmin) {
    if (isPending) return <LoadingBar label="Loading the site" className="fixed top-0" />;
    if (!data) return <SignInPage />;
    if (!data.user.admin && !data.user.allowed) return <WaitingPage player={data.user} />;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <Outlet />
    </div>
  );
}
