import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listPage } from "@/components/page";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { seriesBannerList } from "../../shared/series";

export function HomePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/series", seriesBannerList).then(
      (list) => {
        const running = list.find((s) => s.state === "running");
        if (running) void navigate({ to: "/series/$number", params: { number: String(running.number) }, replace: true });
        else void navigate({ to: "/series", replace: true });
      },
      (caught: unknown) => setError(caught instanceof Error ? caught.message : "Something went wrong"),
    );
  }, [navigate]);

  return (
    <main className={cn(listPage, "py-7 sm:py-9")}>
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
