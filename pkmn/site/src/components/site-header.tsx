import { Link, useMatches } from "@tanstack/react-router";

export function SiteHeader() {
  const title = useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.title)?.staticData.title,
  });

  return (
    <header className="flex h-14 flex-none items-center gap-3.5 border-b bg-card px-4 sm:px-8">
      <Link to="/" className="flex items-baseline gap-1.5 text-foreground">
        <span className="font-heading text-xl font-bold tracking-wide">pkmn</span>
        <span className="font-mono text-xs text-muted-foreground">.enbraile.vip</span>
      </Link>
      {title && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="font-heading text-base font-semibold">{title}</span>
        </>
      )}
    </header>
  );
}
