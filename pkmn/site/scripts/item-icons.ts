import { isNotNull } from "drizzle-orm";
import { db, pool } from "../api/_lib/db.js";
import { refreshItemIcons } from "../api/_lib/item-icons.js";
import { game } from "../api/_lib/schema.js";

const games = await db.select().from(game).where(isNotNull(game.fileKey));
for (const row of games) {
  const icons = await refreshItemIcons(row.id, row.fileKey as string, row.itemIcons);
  console.log(`${row.name}: ${icons ? `${Object.keys(icons.at).length} item icons` : "no Graphics/Items in its zip"}`);
}
await pool.end();
