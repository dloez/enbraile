import { createHash, timingSafeEqual } from "node:crypto";
import { type Context, Hono } from "hono";
import { timing, wrapTime } from "hono/timing";
import { bundleSchema, type Viewer } from "../../shared/bundle.js";
import { asRevision, callLineSchema, coachVoiceSchema, historyImportSchema, messageSchema, ratingSchema, runImportSchema, runVoiceSchema, startRunSchema, stepInSchema, voiceSchema, type ReplyEvent, type VoiceEvent } from "../../shared/runs.js";
import type { Ask } from "./coach.js";
import { warmPool } from "./db.js";
import { requireEnv } from "./env.js";
import { imageFacts, maxImageBytes } from "../../shared/image.js";
import { deleteMap, deleteRun, hasImage, imageOf, storeImage, storeVersion } from "./maps.js";
import { canRead, closeRun, importHistory, importRun, reopenRun, type Time, isActiveMember, joinRun, mapPage, mapsPage, postMessage, postRevision, rateCard, roadmap, runEvents, runList, runLog, runSheet, runVoice, setVoice, startRun, transcript } from "./runs.js";
import { devUserCookie, devUsers, viewerOf } from "./viewer.js";
import { bringCoach, callState, coachVoice, keepCallLine, voiceTurn } from "./voice.js";

const noStore = { "cache-control": "private, no-store" };

const timed =
  (c: Context): Time =>
  (name, work) =>
    wrapTime(c, name, work);

const cursor = (value: string | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

function ndjson<T>(run: (send: (event: T) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      controller.enqueue(encoder.encode("\n"));
      await run((event) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      });
      if (open) controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { ...noStore, "content-type": "application/x-ndjson", "x-accel-buffering": "no" } });
}

function reply(runId: string, viewer: Viewer, ask: Ask, asking: { text: string | null; before?: () => Promise<void> }): Response {
  return ndjson<ReplyEvent>(async (send) => {
    try {
      const { coachTurn } = await import("./coach.js");
      const ended = await coachTurn(runId, viewer, ask, send, { before: asking.before, asking: { text: asking.text, spoken: false } });
      if (ended === "busy") send({ type: "busy" });
    } catch (error) {
      console.error("coach turn failed", error);
      send({ type: "failed" });
    }
    send({ type: "done" });
  });
}

function said(text: string): Response {
  const lines = [{ type: "text", text }, { type: "done" }] satisfies ReplyEvent[];
  return new Response(lines.map((line) => `${JSON.stringify(line)}\n`).join(""), { status: 200, headers: { ...noStore, "content-type": "application/x-ndjson" } });
}

function bearerIs(header: string | undefined, name: string): boolean {
  const expected = Buffer.from(`Bearer ${requireEnv(name)}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const claude = new Hono();

claude.use(async (c, next) => {
  if (!bearerIs(c.req.header("authorization"), "CLAUDE_TOKEN")) return c.json({ error: "forbidden" }, 403);
  await next();
});

claude.put("/maps/:game/:map", async (c) => {
  const parsed = bundleSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidBundle", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }, 400);
  const bundle = parsed.data;
  if (bundle.game !== c.req.param("game") || bundle.map !== c.req.param("map")) return c.json({ error: "pathMismatch" }, 400);
  for (const image of [bundle.image, bundle.survey]) if (image && !(await hasImage(image.digest))) return c.json({ error: "missingImage" }, 400, noStore);
  const stored = await storeVersion(bundle, "claude");
  if (!stored.created) return c.json({ ...stored, held: { waiting: 0, answered: 0 } }, 200, noStore);
  const { retryHeld } = await import("./coach.js");
  return c.json({ ...stored, held: await retryHeld(bundle.game, bundle.map) }, 200, noStore);
});

claude.delete("/maps/:game/:map", async (c) => {
  const deleted = await deleteMap(c.req.param("game"), c.req.param("map"));
  return deleted ? c.json(deleted, 200, noStore) : c.json({ error: "noSuchMap" }, 404, noStore);
});

claude.put("/images/:digest", async (c) => {
  const digest = c.req.param("digest");
  const bytes = Buffer.from(await c.req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxImageBytes) return c.json({ error: "invalidImage" }, 400, noStore);
  if (createHash("sha256").update(bytes).digest("hex") !== digest) return c.json({ error: "digestMismatch" }, 400, noStore);
  const facts = imageFacts(bytes);
  if (!facts) return c.json({ error: "invalidImage" }, 400, noStore);
  return c.json({ digest, created: await storeImage(digest, facts.type, bytes) }, 200, noStore);
});

claude.get("/runs", async (c) => c.json({ runs: await runList() }, 200, noStore));

claude.delete("/runs/:id", async (c) => {
  const deleted = await deleteRun(c.req.param("id"));
  return deleted ? c.json(deleted, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore);
});

claude.post("/runs", async (c) => {
  const parsed = runImportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidImport", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }, 400, noStore);
  const imported = await importRun(parsed.data);
  if ("error" in imported) return c.json(imported, imported.error === "noSuchMap" ? 404 : 400, noStore);
  return c.json(imported, 201, noStore);
});

claude.post("/runs/:id/history", async (c) => {
  const parsed = historyImportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidHistory", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.code}`) }, 400, noStore);
  const imported = await importHistory(c.req.param("id"), parsed.data);
  if ("error" in imported) return c.json(imported, imported.error === "noSuchRun" ? 404 : imported.error === "hasHistory" ? 409 : 400, noStore);
  return c.json(imported, 201, noStore);
});

claude.get("/runs/:id", async (c) => {
  const log = await runLog(c.req.param("id"));
  return log ? c.json(log, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore);
});

claude.get("/runs/:id/events", async (c) => {
  const after = c.req.query("after") ?? "0";
  if (!/^\d{1,18}$/.test(after)) return c.json({ error: "invalidCursor" }, 400, noStore);
  const events = await runEvents(c.req.param("id"), after);
  return events ? c.json(events, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore);
});

claude.post("/runs/:id/date-steps", async (c) => {
  const { anthropic, model } = await import("./coach.js");
  const api = anthropic();
  if (!api) return c.json({ error: "noModel" }, 503, noStore);
  const { dateEarlierSteps } = await import("./dating.js");
  return c.json(await dateEarlierSteps(api, model(), c.req.param("id")), 200, noStore);
});

claude.post("/runs/:id/say", async (c) => {
  const parsed = stepInSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidStepIn", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }, 400, noStore);
  const { stepIn } = await import("./coach.js");
  const result = await stepIn(c.req.param("id"), parsed.data);
  if (result.ok) return c.json({ message: result.message, card: result.card, recorded: result.recorded }, 201, noStore);
  return c.json({ error: result.error }, result.error === "noSuchRun" ? 404 : result.error === "busy" ? 409 : 400, noStore);
});

const voice = new Hono();

voice.post("/", async (c) => {
  if (!bearerIs(c.req.header("authorization"), "INTERNAL_SECRET")) return c.json({ error: "forbidden" }, 403, noStore);
  const parsed = voiceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidVoice" }, 400, noStore);
  const { userId, text, word } = parsed.data;
  return ndjson<VoiceEvent>(async (send) => {
    try {
      await voiceTurn(userId, text, word, send);
    } catch (error) {
      console.error("voice turn failed", error);
    }
    send({ type: "done" });
  });
});

voice.post("/coach", async (c) => {
  if (!bearerIs(c.req.header("authorization"), "INTERNAL_SECRET")) return c.json({ error: "forbidden" }, 403, noStore);
  const parsed = coachVoiceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidVoice" }, 400, noStore);
  return c.json({ voice: await coachVoice(parsed.data.userId) }, 200, noStore);
});

voice.post("/transcript", async (c) => {
  if (!bearerIs(c.req.header("authorization"), "INTERNAL_SECRET")) return c.json({ error: "forbidden" }, 403, noStore);
  const parsed = callLineSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidLine" }, 400, noStore);
  return c.json({ kept: await keepCallLine(parsed.data) }, 200, noStore);
});

const images = new Hono();

images.get("/:digest", async (c) => {
  const digest = c.req.param("digest");
  const image = /^[0-9a-f]{64}$/.test(digest) ? await imageOf(digest) : undefined;
  if (!image) return c.json({ error: "noSuchImage" }, 404, noStore);
  return c.body(new Uint8Array(image.bytes), 200, { "content-type": image.type, "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" });
});

const member = new Hono<{ Variables: { viewer: Viewer } }>();

member.use(async (c, next) => {
  const cookie = c.req.header("cookie");
  const [viewer] = await Promise.all([wrapTime(c, "viewer", viewerOf(cookie)), cookie ? wrapTime(c, "db", warmPool().catch(() => undefined)) : undefined]);
  if (!viewer) return c.json({ error: "signedOut" }, 401, noStore);
  c.set("viewer", viewer);
  await next();
});

member.get("/maps", async (c) => c.json(await mapsPage(c.get("viewer"), timed(c)), 200, noStore));

member.get("/maps/:game/:map", async (c) => {
  const page = await mapPage(c.get("viewer"), c.req.param("game"), c.req.param("map"), timed(c));
  return page ? c.json(page, 200, noStore) : c.json({ error: "noSuchMap" }, 404, noStore);
});

member.post("/runs", async (c) => {
  const parsed = startRunSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidRun" }, 400, noStore);
  const id = await startRun(c.get("viewer"), parsed.data.game, parsed.data.map, parsed.data.language, parsed.data.voice);
  return id ? c.json({ id }, 201, noStore) : c.json({ error: "noSuchMap" }, 404, noStore);
});

member.get("/runs/:id", async (c) => {
  const sheet = await runSheet(c.get("viewer"), c.req.param("id"), timed(c));
  return sheet ? c.json(sheet, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore);
});

member.patch("/runs/:id", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const parsed = runVoiceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidVoice" }, 400, noStore);
  return (await setVoice(id, parsed.data.voice)) ? c.json({ voice: parsed.data.voice }, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore);
});

member.post("/runs/:id/join", async (c) =>
  (await joinRun(c.get("viewer"), c.req.param("id"))) ? c.json({ id: c.req.param("id") }, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore),
);

member.post("/runs/:id/close", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  return (await closeRun(viewer, id)) ? c.json({ id }, 200, noStore) : c.json({ error: "closed" }, 409, noStore);
});

member.post("/runs/:id/reopen", async (c) => {
  const reopened = await reopenRun(c.get("viewer"), c.req.param("id"));
  if (reopened === "ok") return c.json({ id: c.req.param("id") }, 200, noStore);
  return c.json({ error: reopened }, reopened === "noSuchRun" ? 404 : 403, noStore);
});

member.get("/runs/:id/messages", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await canRead(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  return c.json(await transcript(viewer, id, cursor(c.req.query("after")), cursor(c.req.query("rungsAfter"))), 200, noStore);
});

member.post("/runs/:id/messages", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const parsed = messageSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalidMessage" }, 400, noStore);
  const revision = asRevision(parsed.data.text, parsed.data.revision);
  if (revision === "") return c.json({ error: "invalidMessage" }, 400, noStore);
  if (revision !== null) {
    const ack = await postRevision(viewer, id, revision);
    return ack ? said(ack) : c.json({ error: "noSuchRun" }, 404, noStore);
  }
  const text = parsed.data.text;
  return reply(id, viewer, { kind: "message", spoken: false }, { text, before: async () => void (await postMessage(viewer, id, text, false)) });
});

member.post("/runs/:id/cards/:card/more", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const card = cursor(c.req.param("card"));
  if (!card) return c.json({ error: "noSuchCard" }, 404, noStore);
  return reply(id, viewer, { kind: "more", cardId: card }, { text: null });
});

member.put("/runs/:id/cards/:card/feedback", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await isActiveMember(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const parsed = ratingSchema.safeParse(await c.req.json().catch(() => null));
  const card = cursor(c.req.param("card"));
  if (!parsed.success || !card) return c.json({ error: "invalidFeedback" }, 400, noStore);
  return (await rateCard(viewer, id, card, parsed.data.rating)) ? c.json({ rating: parsed.data.rating }, 200, noStore) : c.json({ error: "noSuchCard" }, 404, noStore);
});

member.get("/runs/:id/roadmap", async (c) => {
  const viewer = c.get("viewer");
  const id = c.req.param("id");
  if (!(await canRead(viewer, id))) return c.json({ error: "notInRun" }, 403, noStore);
  const map = await roadmap(id);
  return map ? c.json(map, 200, noStore) : c.json({ error: "noSuchRun" }, 404, noStore);
});

member.get("/runs/:id/voice", async (c) => {
  const viewer = c.get("viewer");
  if (!(await isActiveMember(viewer, c.req.param("id")))) return c.json({ error: "notInRun" }, 403, noStore);
  return c.json(await callState(viewer.discordId), 200, noStore);
});

member.post("/runs/:id/voice/join", async (c) => {
  const viewer = c.get("viewer");
  if (!(await isActiveMember(viewer, c.req.param("id")))) return c.json({ error: "notInRun" }, 403, noStore);
  const coach = await runVoice(c.req.param("id"));
  if (!coach) return c.json({ error: "noSuchRun" }, 404, noStore);
  const joined = await bringCoach(viewer.discordId, coach);
  return "error" in joined ? c.json(joined, joined.error === "botOffline" ? 503 : 409, noStore) : c.json(joined, 200, noStore);
});

const dev = new Hono();

dev.get("/sign-in/:id", (c) => {
  const user = devUsers()?.find((entry) => entry.discordId === c.req.param("id"));
  if (!user) return c.json({ error: "notFound" }, 404);
  c.header("set-cookie", `${devUserCookie}=${encodeURIComponent(user.discordId)}; path=/; httponly; samesite=lax`);
  return c.redirect("/", 302);
});

export const app = new Hono().basePath("/api");

app.use(timing());

app.route("/claude", claude);
app.route("/dev", dev);
app.route("/images", images);
app.route("/voice", voice);
app.route("/", member);
