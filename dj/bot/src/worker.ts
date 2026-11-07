import type { Env } from "./env.js";
import { resolveInput, signTicket, verifyTicket } from "./input.js";
import { type Command, type ContainerEvent, type Loop, Session } from "./session.js";

export { Session };

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;
const USER_AGENT = "DiscordBot (https://dj.enbraile.vip, 1)";
const EPHEMERAL = 64;

type Option = { name: string; value: string | number; focused?: boolean; type?: number; options?: Option[] };
type Interaction = {
  type: number;
  token: string;
  locale?: string;
  member?: { user: { id: string; global_name?: string; username: string }; permissions: string; roles: string[] };
  data?: { name: string; options?: Option[] };
};
type Access = { member: boolean; canManage: boolean; canPlay: boolean };

const text = {
  en: {
    denied: "You need the DJ role to use the bot.",
    notInVoice: "Join a voice channel first.",
    noAccess: "I can't reach your voice channel. Give my role access to it.",
    limit: "The monthly playback limit is used up, so I can't start until next month.",
    nothing: "Nothing is playing.",
    added: (name: string, position: number) => (position > 0 ? `Queued **${name}** at position ${position}.` : `Playing **${name}**.`),
    addedMany: (count: number) => `Queued ${count} tracks.`,
    done: "Done.",
    now: "Now playing",
    upNext: "Up next",
    more: (count: number) => `…and ${count} more`,
    bad: "That didn't work.",
    noResults: "I couldn't read any tracks from that.",
    noPlaylist: "I can't find that playlist.",
  },
  es: {
    denied: "Necesitas el rol de DJ para usar el bot.",
    notInVoice: "Entra primero en un canal de voz.",
    noAccess: "No puedo acceder a tu canal de voz. Dale acceso a mi rol.",
    limit: "Se ha agotado el límite mensual de reproducción, así que no puedo empezar hasta el mes que viene.",
    nothing: "No suena nada.",
    added: (name: string, position: number) => (position > 0 ? `**${name}** en la cola, posición ${position}.` : `Sonando **${name}**.`),
    addedMany: (count: number) => `${count} temas en la cola.`,
    done: "Hecho.",
    now: "Sonando",
    upNext: "A continuación",
    more: (count: number) => `…y ${count} más`,
    bad: "No ha funcionado.",
    noResults: "No he podido leer ningún tema de ahí.",
    noPlaylist: "No encuentro esa lista.",
  },
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
const discord = (env: Env, path: string) => fetch(`https://discord.com/api/v10${path}`, { headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "user-agent": USER_AGENT } });

async function verified(request: Request, body: string, key: string): Promise<boolean> {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!signature || !timestamp || !/^[0-9a-f]+$/i.test(signature)) return false;
  const publicKey = await crypto.subtle.importKey("raw", hexToBytes(key), "Ed25519", false, ["verify"]);
  return crypto.subtle.verify("Ed25519", publicKey, hexToBytes(signature), new TextEncoder().encode(timestamp + body));
}

type VoiceLookup = { channelId: string } | { error: "notInVoice" | "noAccess" };

async function voiceChannel(env: Env, userId: string): Promise<VoiceLookup> {
  const response = await discord(env, `/guilds/${env.GUILD_ID}/voice-states/${userId}`);
  if (response.status === 403) return { error: "noAccess" };
  if (!response.ok) return { error: "notInVoice" };
  const state = (await response.json()) as { channel_id: string | null };
  return state.channel_id ? { channelId: state.channel_id } : { error: "notInVoice" };
}

async function accessOf(env: Env, userId: string): Promise<Access> {
  const member = await discord(env, `/guilds/${env.GUILD_ID}/members/${userId}`);
  if (!member.ok) return { member: false, canManage: false, canPlay: false };
  const { roles } = (await member.json()) as { roles: string[] };
  const guild = (await (await discord(env, `/guilds/${env.GUILD_ID}`)).json()) as { owner_id: string; roles: { id: string; permissions: string }[] };
  const held = new Set([...roles, env.GUILD_ID]);
  const bits = guild.roles.filter((role) => held.has(role.id)).reduce((total, role) => total | BigInt(role.permissions), 0n);
  const canManage = guild.owner_id === userId || (bits & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
  const { djRoleId } = await env.SESSION.getByName(env.GUILD_ID).settings();
  return { member: true, canManage, canPlay: canManage || (djRoleId !== null && roles.includes(djRoleId)) };
}

function parseTime(input: string): number | null {
  const parts = input.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0) || parts.length > 3) return null;
  return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

async function enqueueInput(env: Env, input: string, channelId: string, userId: string) {
  const session = env.SESSION.getByName(env.GUILD_ID);
  const items = await resolveInput(input, (url) => session.expand(url));
  if (!items.length) return null;
  return { items, result: await session.enqueue(channelId, items, userId) };
}

async function handle(env: Env, interaction: Interaction): Promise<string> {
  const t = interaction.locale?.startsWith("es") ? text.es : text.en;
  const member = interaction.member;
  if (!member) return t.denied;
  const session = env.SESSION.getByName(env.GUILD_ID);
  const { djRoleId } = await session.settings();
  const canManage = (BigInt(member.permissions) & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
  if (!canManage && !(djRoleId && member.roles.includes(djRoleId))) return t.denied;
  const name = interaction.data?.name;
  const options = interaction.data?.options ?? [];
  const option = (key: string, from = options) => from.find((entry) => entry.name === key)?.value;
  if (name === "play") {
    const voice = await voiceChannel(env, member.user.id);
    if ("error" in voice) return t[voice.error];
    const outcome = await enqueueInput(env, String(option("query")), voice.channelId, member.user.id);
    if (!outcome) return t.noResults;
    if (!outcome.result.ok) return t.limit;
    return outcome.items.length > 1 ? t.addedMany(outcome.items.length) : t.added(outcome.items[0]!.title ?? "", outcome.result.position);
  }
  if (name === "playlist") {
    const voice = await voiceChannel(env, member.user.id);
    if ("error" in voice) return t[voice.error];
    const play = options[0]?.options ?? [];
    const tracks = await session.playlistTracks(String(option("name", play)));
    if (!tracks.length) return t.noPlaylist;
    const result = await session.enqueue(voice.channelId, tracks, member.user.id);
    return result.ok ? t.addedMany(tracks.length) : t.limit;
  }
  if (name === "queue") {
    const view = await session.view();
    const now = view.tracks[view.current];
    if (!view.active || !now) return t.nothing;
    const upcoming = view.tracks.slice(view.current + 1);
    const lines = upcoming.slice(0, 10).map((track, index) => `${index + 1}. ${track.title}`);
    if (upcoming.length > 10) lines.push(t.more(upcoming.length - 10));
    return [`**${t.now}:** ${now.title}`, ...(lines.length ? [`**${t.upNext}:**`, ...lines] : [])].join("\n");
  }
  const command = ((): Command | null => {
    if (name === "skip" || name === "pause" || name === "resume" || name === "stop" || name === "shuffle") return { action: name };
    if (name === "loop") return { action: "loop", loop: String(option("mode")) as Loop };
    if (name === "autoplay") return { action: "autoplay", on: String(option("mode")) === "on" };
    if (name === "volume") return { action: "volume", volume: Number(option("percent")) / 100 };
    if (name === "seek") {
      const positionMs = parseTime(String(option("time")));
      return positionMs === null ? null : { action: "seek", positionMs };
    }
    return null;
  })();
  if (!command) return t.bad;
  await session.command(command);
  return t.done;
}

async function followUp(env: Env, interaction: Interaction): Promise<void> {
  const t = interaction.locale?.startsWith("es") ? text.es : text.en;
  const content = await handle(env, interaction).catch((error: Error) => {
    console.error("command", interaction.data?.name, error.message);
    return t.bad;
  });
  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
}

async function autocomplete(env: Env, interaction: Interaction): Promise<Response> {
  const typed = String(interaction.data?.options?.[0]?.options?.find((entry) => entry.focused)?.value ?? "").toLowerCase();
  const lists = await env.SESSION.getByName(env.GUILD_ID).playlists();
  const choices = lists.filter((list) => list.name.toLowerCase().includes(typed)).slice(0, 25).map((list) => ({ name: `${list.name} (${list.ownerName})`.slice(0, 100), value: list.id }));
  return json({ type: 8, data: { choices } });
}

async function internal(request: Request, env: Env, path: string): Promise<Response> {
  if (request.headers.get("authorization") !== `Bearer ${env.INTERNAL_SECRET}`) return new Response("not found", { status: 404 });
  const session = env.SESSION.getByName(env.GUILD_ID);
  const input = (request.method === "POST" ? await request.json() : {}) as Record<string, unknown>;
  const userId = String(input.userId ?? new URL(request.url).searchParams.get("userId") ?? "");
  const name = String(input.ownerName ?? "");
  const id = String(input.id ?? "");
  const denied = () => json({ error: "forbidden" }, 403);
  if (path === "/internal/event") {
    await session.event(input as ContainerEvent);
    return json({ ok: true });
  }
  const access = await accessOf(env, userId);
  if (path === "/internal/access") return json(access);
  if (!access.member) return denied();
  if (path === "/internal/settings") {
    if (!access.canManage) return denied();
    if (request.method === "POST") await session.setSettings({ djRoleId: (input.djRoleId as string | null) ?? null, hourLimit: Number(input.hourLimit) });
    const roles = (await (await discord(env, `/guilds/${env.GUILD_ID}/roles`)).json()) as { id: string; name: string; managed: boolean; position: number }[];
    return json({ ...(await session.settings()), roles: roles.filter((role) => role.id !== env.GUILD_ID && !role.managed).sort((a, b) => b.position - a.position).map((role) => ({ id: role.id, name: role.name })) });
  }
  if (!access.canPlay) return denied();
  switch (path) {
    case "/internal/state":
      return json(await session.view());
    case "/internal/ticket":
      return json({ ticket: await signTicket(env.INTERNAL_SECRET), url: `${env.WORKER_URL.replace("https://", "wss://")}/live` });
    case "/internal/command":
      await session.command(input.command as Command);
      return json(await session.view());
    case "/internal/enqueue": {
      const voice = await voiceChannel(env, userId);
      const needsVoice = "error" in voice;
      const view = await session.view();
      const channelId = needsVoice ? view.channelId : voice.channelId;
      if (!channelId) return json(needsVoice ? voice : { error: "notInVoice" }, 409);
      const items = input.items as { query: string; title?: string }[] | undefined;
      if (items) return json(await session.enqueue(channelId, items, userId));
      const outcome = await enqueueInput(env, String(input.input), channelId, userId);
      return outcome ? json(outcome.result) : json({ error: "noResults" }, 422);
    }
    case "/internal/history":
      return json(await session.history());
    case "/internal/playlists":
      if (request.method === "POST") return json({ id: await session.createPlaylist(String(input.name), userId, name) });
      return json(await session.playlists());
    case "/internal/playlist/tracks":
      return json(await session.playlistTracks(new URL(request.url).searchParams.get("id") ?? ""));
    case "/internal/playlist/rename":
      return (await session.renamePlaylist(id, userId, String(input.name))) ? json({ ok: true }) : denied();
    case "/internal/playlist/delete":
      return (await session.deletePlaylist(id, userId)) ? json({ ok: true }) : denied();
    case "/internal/playlist/add": {
      const items = await resolveInput(String(input.input), (url) => session.expand(url));
      const named = items.map((item) => ({ query: item.query, title: item.title ?? item.query.replace(/^ytsearch\d*:/, "") }));
      return (await session.addToPlaylist(id, userId, named)) ? json({ added: named.length }) : denied();
    }
    case "/internal/playlist/remove":
      return (await session.removeFromPlaylist(id, userId, String(input.trackId))) ? json({ ok: true }) : denied();
    case "/internal/playlist/move":
      return (await session.movePlaylistTrack(id, userId, String(input.trackId), Number(input.to))) ? json({ ok: true }) : denied();
  }
  return new Response("not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/live") {
      if (request.headers.get("upgrade") !== "websocket" || !(await verifyTicket(url.searchParams.get("ticket") ?? "", env.INTERNAL_SECRET))) return new Response("not found", { status: 404 });
      return env.SESSION.getByName(env.GUILD_ID).fetch(request);
    }
    if (path.startsWith("/internal/")) return internal(request, env, path);
    if (path !== "/interactions" || request.method !== "POST") return new Response("not found", { status: 404 });
    const body = await request.text();
    if (!(await verified(request, body, env.DISCORD_PUBLIC_KEY))) return new Response("invalid signature", { status: 401 });
    const interaction = JSON.parse(body) as Interaction;
    if (interaction.type === 1) return json({ type: 1 });
    if (interaction.type === 4) return autocomplete(env, interaction);
    ctx.waitUntil(followUp(env, interaction));
    return json({ type: 5, data: { flags: interaction.data?.name === "queue" ? EPHEMERAL : 0 } });
  },
};
