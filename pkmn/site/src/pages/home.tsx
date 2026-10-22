import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { liftCardClass } from "@/components/controls";
import { listPage } from "@/components/page";
import { cn } from "@/lib/utils";
import { tools } from "@/tools";

export function HomePage() {
  return (
    <main className={cn(listPage, "gap-7 py-7 sm:py-9")}>
      <h1 className="m-0 font-heading text-5xl leading-none sm:text-6xl">Tools</h1>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to} className={cn(liftCardClass, "flex items-center gap-3 px-5 py-4.5")}>
            <span className="flex-1 font-heading text-4xl">{tool.name}</span>
            <ArrowRight className="size-6 text-primary" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </main>
  );
}
