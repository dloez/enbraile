import { useEffect, useState } from "react";
import { teamsToBuild } from "../../shared/team";
import { api } from "@/lib/api";

const recounts = new EventTarget();

export function recountTeamsToBuild() {
  recounts.dispatchEvent(new Event("recount"));
}

export function useTeamsToBuild(player: string | null, pathname: string): number {
  const [answer, setAnswer] = useState<{ player: string; count: number } | null>(null);
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    const ask = () => setAsked((n) => n + 1);
    recounts.addEventListener("recount", ask);
    return () => recounts.removeEventListener("recount", ask);
  }, []);
  useEffect(() => {
    if (player === null) return;
    let live = true;
    api("/teams/to-build", teamsToBuild).then(
      (got) => live && setAnswer({ player, count: got.count }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [player, pathname, asked]);
  return answer !== null && answer.player === player ? answer.count : 0;
}
