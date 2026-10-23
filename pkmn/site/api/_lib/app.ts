import { Hono } from "hono";
import { requireAllowed } from "./access.js";
import { adminSeries } from "./admin-series.js";
import { auth } from "./auth.js";
import { games } from "./games.js";
import { overrides } from "./overrides.js";
import { players } from "./players.js";
import { profiles } from "./profiles.js";
import { saveUploads } from "./save-uploads.js";
import { seriesRoutes } from "./series.js";

export const app = new Hono().basePath("/api");

app.use(requireAllowed);

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/games", games);
app.route("/players", players);
app.route("/profiles", profiles);
app.route("/series", seriesRoutes);
app.route("/series", saveUploads);
app.route("/series", overrides);
app.route("/admin/series", adminSeries);
