import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { itemIcons, type ItemIcons } from "../../shared/items";

export type GameIcons = ItemIcons & { url: string };

const GameIconsContext = createContext<GameIcons | null>(null);

const loaded = new Map<string, Promise<GameIcons | null>>();

function load(game: string): Promise<GameIcons | null> {
  let held = loaded.get(game);
  if (!held) {
    held = api(`/item-icons/${encodeURIComponent(game)}`, itemIcons.nullable()).then(
      (icons) => icons && { ...icons, url: `/api/item-icons/${encodeURIComponent(game)}/${icons.version}.png` },
      () => {
        loaded.delete(game);
        return null;
      },
    );
    loaded.set(game, held);
  }
  return held;
}

export function GameIconsProvider({ game, children }: { game: string | null; children: ReactNode }) {
  const [icons, setIcons] = useState<GameIcons | null>(null);

  useEffect(() => {
    let live = true;
    setIcons(null);
    if (game) void load(game).then((next) => live && setIcons(next));
    return () => {
      live = false;
    };
  }, [game]);

  return <GameIconsContext.Provider value={icons}>{children}</GameIconsContext.Provider>;
}

export function useGameIcons(): GameIcons | null {
  return useContext(GameIconsContext);
}
