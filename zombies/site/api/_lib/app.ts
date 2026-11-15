import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bundleSchema, type Viewer } from "../../shared/bundle.js";
import { requireEnv } from "./env.js";
import { publishedMaps, storeVersion } from "./maps.js";
import { viewerOf } from "./viewer.js";

const noStore = { "cache-control": "private, no-store" };

function isAdmin(header: string | undefined): boolean {
  const expected = Buffer.from(`Bearer ${requireEnv("ZOMBIES_ADMIN_TOKEN")}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const admin = new Hono();

admin.use(async (c, next) => {
  if (!isAdmin(c.req.header("authorization"))) return c.json({ error: "forbidden" }, 403);
  await next();
});

admin.put("/maps/:game/:map", async (c) => {
  const parsed = bundleSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidBundle", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }, 400);
  const bundle = parsed.data;
  if (bundle.game !== c.req.param("game") || bundle.map !== c.req.param("map")) return c.json({ error: "pathMismatch" }, 400);
  return c.json(await storeVersion(bundle), 200, noStore);
});

const member = new Hono<{ Variables: { viewer: Viewer } }>();

member.use(async (c, next) => {
  const viewer = await viewerOf(c.req.header("cookie"));
  if (!viewer) return c.json({ error: "signedOut" }, 401, noStore);
  c.set("viewer", viewer);
  await next();
});

member.get("/me", (c) => {
  const { name, image, discordId } = c.get("viewer");
  return c.json({ user: { name, image, discordId } }, 200, noStore);
});

member.get("/maps", async (c) => c.json({ maps: await publishedMaps() }, 200, noStore));

export const app = new Hono().basePath("/api");

app.route("/admin", admin);
app.route("/", member);
