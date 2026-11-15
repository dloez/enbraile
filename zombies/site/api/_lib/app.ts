import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bundleSchema, type Viewer } from "../../shared/bundle.js";
import { messageSchema, startRunSchema } from "../../shared/runs.js";
import { requireEnv } from "./env.js";
import { storeVersion } from "./maps.js";
import { isActiveMember, joinRun, mapsPage, postMessage, runSheet, startRun, transcript } from "./runs.js";
import { devUserCookie, devUsers, viewerOf } from "./viewer.js";

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

member.get("/maps", async (c) => c.json(await mapsPage(c.get("viewer")), 200, noStore));

member.post("/runs", async (c) => {
  const parsed = startRunSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidRun" }, 400, noStore);
  const id = await startRun(c.get("viewer"), parsed.data.game, parsed.data.map, parsed.data.language);
  return id ? c.json({ id }, 201, noStore) : c.json({ error: "noSuchMap" }, 404, noStore);
});

member.get("/runs/:id", async (c) => {
  const sheet = await runSheet(c.get("viewer"), c.req.param("id"));
  return sheet ? c.json(sheet, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore);
});

member.post("/runs/:id/join", async (c) =>
  (await joinRun(c.get("viewer"), c.req.param("id"))) ? c.json({ id: c.req.param("id") }, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore),
);

member.get("/runs/:id/messages", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const after = Number(c.req.query("after") ?? 0);
  return c.json(await transcript(viewer, id, Number.isInteger(after) && after > 0 ? after : 0), 200, noStore);
});

member.post("/runs/:id/messages", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const parsed = messageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidMessage" }, 400, noStore);
  await postMessage(viewer, id, parsed.data.text);
  return c.json({ ok: true }, 201, noStore);
});

const dev = new Hono();

dev.get("/sign-in/:id", (c) => {
  const user = devUsers()?.find((entry) => entry.discordId === c.req.param("id"));
  if (!user) return c.json({ error: "notFound" }, 404);
  c.header("set-cookie", `${devUserCookie}=${encodeURIComponent(user.discordId)}; path=/; httponly; samesite=lax`);
  return c.redirect("/", 302);
});

export const app = new Hono().basePath("/api");

app.route("/admin", admin);
app.route("/dev", dev);
app.route("/", member);
