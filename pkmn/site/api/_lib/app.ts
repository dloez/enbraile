import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { requireAllowed } from "./access.js";
import { adminSeries } from "./admin-series.js";
import { auth } from "./auth.js";
import { db } from "./db.js";
import { games } from "./games.js";
import { itemIconRoutes } from "./item-icons.js";
import { league } from "./league.js";
import { overrides } from "./overrides.js";
import { players } from "./players.js";
import { profiles } from "./profiles.js";
import { saveUploads } from "./save-uploads.js";
import { user } from "./schema.js";
import { seriesRoutes } from "./series.js";
import { cron } from "./sweep.js";
import { teams } from "./teams.js";

export const app = new Hono().basePath("/api");

app.use(requireAllowed);

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.post("/join", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "signIn" }, 401);
  await db.update(user).set({ pkmnRequestedAt: new Date() }).where(and(eq(user.id, session.user.id), isNull(user.pkmnRequestedAt)));
  return c.json({ ok: true });
});

app.route("/games", games);
app.route("/item-icons", itemIconRoutes);
app.route("/players", players);
app.route("/profiles", profiles);
app.route("/series", seriesRoutes);
app.route("/series", saveUploads);
app.route("/series", overrides);
app.route("/series", league);
app.route("/admin/series", adminSeries);
app.route("/teams", teams);
app.route("/cron", cron);
