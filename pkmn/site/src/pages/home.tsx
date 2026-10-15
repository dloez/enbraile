import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { tools } from "@/tools";

export function HomePage() {
  return (
    <main className="flex-1 px-4 py-7 sm:px-8 sm:py-16">
      <div className="mx-auto flex max-w-240 flex-col gap-7">
        <h1 className="font-heading text-[34px] leading-tight font-bold sm:text-5xl">Tools</h1>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4.5 text-foreground transition-colors hover:border-primary"
            >
              <span className="flex-1 font-heading text-[22px] font-semibold">{tool.name}</span>
              <ArrowRight className="size-5.5 text-primary" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
