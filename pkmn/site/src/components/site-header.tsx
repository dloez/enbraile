import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SignOutIcon, useSignOut } from "@/components/sign-out";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Tab = { label: string; to: "/series" | "/open-sheet" | "/team-analysis" | "/admin"; icon: PixelIconName };

const TABS: readonly Tab[] = [
  { label: "Series", to: "/series", icon: "flag" },
  { label: "PC", to: "/open-sheet", icon: "monitor" },
  { label: "Teams", to: "/team-analysis", icon: "people" },
];

const ADMIN_TAB: Tab = { label: "Admin", to: "/admin", icon: "key" };

type User = { id: string; name: string; admin?: boolean | null };

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function SiteHeader() {
  const { data } = authClient.useSession();
  const user = data?.user;
  const tabs = user?.admin ? [...TABS, ADMIN_TAB] : TABS;
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="relative z-20 flex h-15 flex-none items-center gap-2 border-b-4 border-red bg-ink pr-2 pl-3 sm:h-16 sm:gap-7 sm:px-8">
        <Link to="/" aria-label="Home" className={`grid size-11 flex-none place-items-center rounded-md sm:size-12 ${focus}`}>
          <PixelIcon name="ball" className="size-8 sm:size-9" />
        </Link>
        <nav aria-label="Sections" className="hidden items-end gap-1 self-stretch sm:flex">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex h-12 items-center gap-2.5 rounded-t-lg px-5 font-heading text-2xl ${focus}`}
              activeProps={{ className: "bg-red text-white" }}
              inactiveProps={{ className: "text-subtle hover:bg-card hover:text-white" }}
            >
              <PixelIcon name={tab.icon} />
              {tab.label}
            </Link>
          ))}
        </nav>
        {user && <Account user={user} />}
        <PhoneMenu tabs={tabs} user={user} open={open} setOpen={setOpen} />
      </header>
      {open && (
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-10 bg-scrim sm:hidden" />
      )}
    </>
  );
}

function Account({ user }: { user: User }) {
  const { signingOut, signOut } = useSignOut();
  return (
    <div className="ml-auto hidden min-w-0 items-center gap-3 sm:flex">
      {!user.admin && <PlayerBadge name={user.name} colour={playerColour(user.id)} />}
      <span className="truncate font-heading text-2xl text-white">{user.name}</span>
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        disabled={signingOut}
        onClick={signOut}
        className={`grid size-11 flex-none cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-white disabled:opacity-50 ${focus}`}
      >
        <SignOutIcon className="size-5" />
      </button>
    </div>
  );
}

const menuItem = `flex min-h-13 items-center gap-3.5 rounded-lg px-3.5 font-heading text-[1.75rem] ${focus}`;

function PhoneMenu({
  tabs,
  user,
  open,
  setOpen,
}: {
  tabs: readonly Tab[];
  user: User | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { signingOut, signOut } = useSignOut();
  const current = tabs.find((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`));

  useEffect(() => setOpen(false), [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, setOpen]);

  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2 font-heading text-[1.625rem] text-white sm:hidden">
        {current && (
          <>
            <PixelIcon name={current.icon} className="size-4 text-red" />
            <span className="truncate">{current.label}</span>
          </>
        )}
      </span>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="phone-menu"
        onClick={() => setOpen(!open)}
        className={cn(
          "grid size-11 flex-none cursor-pointer place-items-center rounded-md text-white hover:bg-card sm:hidden",
          open && "bg-card",
          focus,
        )}
      >
        {open ? <PixelIcon name="cross" className="size-5" /> : <PixelIcon name="menu" className="size-5.5" />}
      </button>
      {open && (
        <nav
          id="phone-menu"
          aria-label="Sections"
          className="absolute inset-x-0 top-full mt-1 flex flex-col gap-1 border-b-4 border-border bg-ink px-3 pt-2.5 pb-3.5 sm:hidden"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              onClick={() => setOpen(false)}
              className={menuItem}
              activeProps={{ className: "bg-red text-white" }}
              inactiveProps={{ className: "text-subtle hover:bg-card hover:text-white" }}
            >
              <PixelIcon name={tab.icon} />
              {tab.label}
            </Link>
          ))}
          {user && (
            <>
              <span aria-hidden="true" className="mx-0.5 my-1.5 h-0.75 bg-cell" />
              <div className={cn(menuItem, "text-white")}>
                {!user.admin && (
                  <span className="-ml-1.75 flex">
                    <PlayerBadge name={user.name} colour={playerColour(user.id)} size="xs" />
                  </span>
                )}
                <span className="truncate">{user.name}</span>
              </div>
              <button
                type="button"
                disabled={signingOut}
                onClick={signOut}
                className={cn(
                  menuItem,
                  "cursor-pointer text-left text-muted-foreground hover:bg-card hover:text-white disabled:opacity-50",
                )}
              >
                <SignOutIcon className="size-4.5 flex-none" />
                Sign out
              </button>
            </>
          )}
        </nav>
      )}
    </>
  );
}
