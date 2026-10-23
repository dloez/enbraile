import { Link } from "@tanstack/react-router";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icon";
import { PlayerBadge, playerColour } from "@/components/player-badge";
import { SignOutIcon, useSignOut } from "@/components/sign-out";
import { authClient } from "@/lib/auth-client";

const TABS: readonly { label: string; to: "/open-sheet" | "/team-analysis"; icon: PixelIconName }[] = [
  { label: "PC", to: "/open-sheet", icon: "monitor" },
  { label: "Teams", to: "/team-analysis", icon: "people" },
];

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function SiteHeader() {
  const { data } = authClient.useSession();
  return (
    <header className="flex h-16 flex-none items-center gap-2 border-b-4 border-red bg-ink px-4 sm:gap-7 sm:px-8">
      <Link to="/" aria-label="Home" className={`grid size-12 flex-none place-items-center rounded-md ${focus}`}>
        <PixelIcon name="ball" className="size-9" />
      </Link>
      <nav aria-label="Sections" className="flex items-end gap-1 self-stretch">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`flex h-12 items-center gap-2.5 rounded-t-lg px-3 font-heading text-2xl sm:px-5 ${focus}`}
            activeProps={{ className: "bg-red text-white" }}
            inactiveProps={{ className: "text-subtle hover:bg-card hover:text-white" }}
          >
            <PixelIcon name={tab.icon} />
            {tab.label}
          </Link>
        ))}
      </nav>
      {data && <Account user={data.user} />}
    </header>
  );
}

function Account({ user }: { user: { id: string; name: string; admin?: boolean | null } }) {
  const { signingOut, signOut } = useSignOut();
  return (
    <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
      {!user.admin && <PlayerBadge name={user.name} colour={playerColour(user.id)} />}
      <span className="hidden truncate font-heading text-2xl text-white sm:inline">{user.name}</span>
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
