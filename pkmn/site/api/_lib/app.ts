import { Hono } from "hono";
import { requireAllowed } from "./access.js";
import { auth } from "./auth.js";
import { games } from "./games.js";
import { players } from "./players.js";

export const app = new Hono().basePath("/api");

app.use(requireAllowed);

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/games", games);
app.route("/players", players);
