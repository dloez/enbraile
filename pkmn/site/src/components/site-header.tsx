import { Link } from "@tanstack/react-router";
import { PixelIcon, type PixelIconName } from "@/components/pixel-icon";

const TABS: readonly { label: string; to: "/open-sheet" | "/team-analysis"; icon: PixelIconName }[] = [
  { label: "PC", to: "/open-sheet", icon: "monitor" },
  { label: "Teams", to: "/team-analysis", icon: "people" },
];

const focus = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function SiteHeader() {
  return (
    <header className="flex h-16 flex-none items-center gap-3 border-b-4 border-red bg-ink px-4 sm:gap-7 sm:px-8">
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
    </header>
  );
}
