import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { liftCardClass } from "@/components/controls";
import { toolPage } from "@/components/page";
import { SCENE_LOOK, SceneArt } from "@/components/scene";
import { useMediaQuery } from "@/hooks/use-media-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type Scene, type SeriesBanner, seriesBannerList } from "../../shared/series";

const BANNER_SIZE: Record<Scene, [number, number]> = { night: [338, 33], route: [338, 55] };

const PHONE_BANNER_SIZE: Record<Scene, [number, number]> = { night: [88, 33], route: [88, 55] };

export function gameLine(game: string): string {
  return game.split(" + ").join(" · ");
}

export function SeriesListPage() {
  const [list, setList] = useState<SeriesBanner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/series", seriesBannerList).then(setList, (caught: unknown) =>
      setError(caught instanceof Error ? caught.message : "Something went wrong"),
    );
  }, []);

  return (
    <main className={cn(toolPage, "gap-4.5 pt-5.5 pb-8 sm:gap-5.5 sm:py-9")}>
      <h1 className="m-0 font-heading text-5xl leading-none font-normal sm:text-6xl">Series</h1>
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {list && (
        <ul className="m-0 flex list-none flex-col gap-4 p-0 sm:gap-6">
          {list.map((s) => (
            <li key={s.number}>
              <SeriesBannerLink series={s} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function SeriesBannerLink({ series }: { series: SeriesBanner }) {
  const look = SCENE_LOOK[series.scene];
  const desktop = useMediaQuery("(min-width: 40rem)");
  const [width, height] = (desktop ? BANNER_SIZE : PHONE_BANNER_SIZE)[series.scene];
  const playing = series.state === "running";
  return (
    <Link
      to="/series/$number"
      params={{ number: String(series.number) }}
      className={cn(liftCardClass, "relative block h-35 overflow-hidden text-white", look.ground)}
    >
      <SceneArt scene={series.scene} width={width} height={height} />
      <span className="absolute top-4.5 right-4 left-4 flex flex-col items-start gap-2.5 sm:top-5.5 sm:right-auto sm:left-8">
        <span className={cn("font-heading text-[3.25rem] leading-[0.8] sm:text-6xl", look.title)}>{series.name}</span>
        {series.game && (
          <span className={cn("rounded-md px-2.5 py-0.5 text-[0.9375rem] font-extrabold sm:px-3 sm:text-lg", look.chip)}>
            {gameLine(series.game)}
          </span>
        )}
      </span>
      <span
        className={cn(
          "absolute top-3.5 right-3 rounded-md border-3 border-ink px-2.5 font-heading text-xl sm:top-5 sm:right-6 sm:px-3.5 sm:text-2xl",
          playing ? "bg-primary text-primary-foreground" : "bg-ink text-foreground",
        )}
      >
        {playing ? "Playing now" : "Finished"}
      </span>
    </Link>
  );
}
