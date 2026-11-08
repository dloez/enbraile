import { Hono } from "hono";

type Viewer = { name: string; image: string | null; discordId: string };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function viewerOf(cookie: string | undefined): Promise<Viewer | null> {
  const devUser = process.env.DEV_USER_ID;
  if (devUser) return { name: "Local", image: null, discordId: devUser };
  if (!cookie) return null;
  const response = await fetch(`${env("ROOT_URL")}/api/me`, { headers: { cookie } });
  if (!response.ok) return null;
  const { user } = (await response.json()) as { user: { name: string; image: string | null; discordId: string | null } | null };
  return user?.discordId ? { name: user.name, image: user.image, discordId: user.discordId } : null;
}

const worker = (path: string, init?: RequestInit) => fetch(`${env("BOT_URL")}/internal/${path}`, { ...init, headers: { authorization: `Bearer ${env("INTERNAL_SECRET")}`, "content-type": "application/json" } });

const relay = async (response: Response) => new Response(await response.text(), { status: response.status, headers: { "content-type": "application/json", "cache-control": "private, no-store" } });

const reads = new Set(["search", "artists", "artist", "album", "suggestions", "state", "ticket", "history", "sessions", "session/tracks", "playlists", "playlist/tracks", "playlist/suggestions", "settings"]);
const writes = new Set(["command", "enqueue", "warm", "playlists", "playlist/rename", "playlist/delete", "playlist/add", "playlist/remove", "playlist/move", "playlist/visibility", "playlist/from-session", "playlist/merge-session", "settings"]);

export const app = new Hono().basePath("/api");

app.use(async (c, next) => {
  const viewer = await viewerOf(c.req.header("cookie"));
  if (!viewer) return c.json({ error: "signedOut" }, 401);
  c.set("viewer" as never, viewer as never);
  await next();
});

app.get("/me", async (c) => {
  const viewer = c.get("viewer" as never) as Viewer;
  const read = async (path: string) => {
    const response = await worker(`${path}?userId=${viewer.discordId}`);
    return response.ok ? ((await response.json()) as unknown) : null;
  };
  const [access, state, live, sessions, playlists] = await Promise.all([read("access"), read("state"), read("ticket"), read("sessions"), read("playlists")]).catch(() => [null, null, null, null, null]);
  if (!access) return c.json({ error: "botUnavailable" }, 502, { "cache-control": "private, no-store" });
  const idle = state && !(state as { active?: boolean }).active && sessions && playlists ? { sessions, playlists } : null;
  return c.json({ user: { name: viewer.name, image: viewer.image }, discordId: viewer.discordId, ...(access as Record<string, unknown>), state, live, idle }, 200, { "cache-control": "private, no-store" });
});

app.get("/*", async (c) => {
  const path = c.req.path.replace(/^\/api\//, "");
  if (!reads.has(path)) return c.json({ error: "notFound" }, 404);
  const viewer = c.get("viewer" as never) as Viewer;
  const query = new URLSearchParams(new URL(c.req.url).search);
  query.set("userId", viewer.discordId);
  return relay(await worker(`${path}?${query}`));
});

app.post("/*", async (c) => {
  const path = c.req.path.replace(/^\/api\//, "");
  if (!writes.has(path)) return c.json({ error: "notFound" }, 404);
  const viewer = c.get("viewer" as never) as Viewer;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  return relay(await worker(path, { method: "POST", body: JSON.stringify({ ...body, userId: viewer.discordId, ownerName: viewer.name }) }));
});
