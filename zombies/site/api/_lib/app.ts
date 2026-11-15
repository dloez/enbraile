import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bundleSchema, type Viewer } from "../../shared/bundle.js";
import { messageSchema, startRunSchema, type ReplyEvent } from "../../shared/runs.js";
import { coachTurn, type Ask } from "./coach.js";
import { requireEnv } from "./env.js";
import { storeVersion } from "./maps.js";
import { isActiveMember, joinRun, mapsPage, postMessage, runSheet, startRun, transcript } from "./runs.js";
import { devUserCookie, devUsers, viewerOf } from "./viewer.js";

const noStore = { "cache-control": "private, no-store" };

const cursor = (value: string | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

function reply(runId: string, viewer: Viewer, ask: Ask): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: ReplyEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await coachTurn(runId, viewer, ask, send);
      } catch (error) {
        console.error("coach turn failed", error);
      }
      send({ type: "done" });
      if (open) controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { ...noStore, "content-type": "application/x-ndjson", "x-accel-buffering": "no" } });
}

function isClaude(header: string | undefined): boolean {
  const expected = Buffer.from(`Bearer ${requireEnv("CLAUDE_TOKEN")}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const claude = new Hono();

claude.use(async (c, next) => {
  if (!isClaude(c.req.header("authorization"))) return c.json({ error: "forbidden" }, 403);
  await next();
});

claude.put("/maps/:game/:map", async (c) => {
  const parsed = bundleSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidBundle", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }, 400);
  const bundle = parsed.data;
  if (bundle.game !== c.req.param("game") || bundle.map !== c.req.param("map")) return c.json({ error: "pathMismatch" }, 400);
  return c.json(await storeVersion(bundle, "claude"), 200, noStore);
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
  return c.json(await transcript(viewer, id, cursor(c.req.query("after")), cursor(c.req.query("rungsAfter"))), 200, noStore);
});

member.post("/runs/:id/messages", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const parsed = messageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidMessage" }, 400, noStore);
  await postMessage(viewer, id, parsed.data.text);
  return reply(id, viewer, { kind: "message" });
});

member.post("/runs/:id/cards/:card/more", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const card = cursor(c.req.param("card"));
  if (!card) return c.json({ error: "noSuchCard" }, 404, noStore);
  return reply(id, viewer, { kind: "more", cardId: card });
});

const dev = new Hono();

dev.get("/sign-in/:id", (c) => {
  const user = devUsers()?.find((entry) => entry.discordId === c.req.param("id"));
  if (!user) return c.json({ error: "notFound" }, 404);
  c.header("set-cookie", `${devUserCookie}=${encodeURIComponent(user.discordId)}; path=/; httponly; samesite=lax`);
  return c.redirect("/", 302);
});

export const app = new Hono().basePath("/api");

app.route("/claude", claude);
app.route("/dev", dev);
app.route("/", member);
