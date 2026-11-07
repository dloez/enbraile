import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import { guild } from "./client.ts";
import { accessOf, enqueueInput, voiceChannel } from "./discord.ts";
import { resolveInput, signTicket, verifyTicket } from "./input.ts";
import { searchSongs } from "./music.ts";
import * as session from "./session.ts";

const secret = process.env.INTERNAL_SECRET ?? "";
const publicUrl = process.env.PUBLIC_URL ?? "http://localhost:8080";

function reply(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return chunks.length ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>) : {};
}

async function internal(request: IncomingMessage, url: URL): Promise<[unknown, number?]> {
  const path = url.pathname;
  const input = request.method === "POST" ? await body(request) : {};
  const userId = String(input.userId ?? url.searchParams.get("userId") ?? "");
  const id = String(input.id ?? "");
  const denied: [unknown, number] = [{ error: "forbidden" }, 403];
  const access = await accessOf(userId);
  if (path === "/internal/access") return [access];
  if (!access.member) return denied;
  if (path === "/internal/settings") {
    if (!access.canManage) return denied;
    if (request.method === "POST") session.setSettings({ djRoleId: (input.djRoleId as string | null) ?? null });
    const roles = await (await guild()).roles.fetch();
    return [{ ...session.settings(), roles: [...roles.values()].filter((role) => role.id !== role.guild.id && !role.managed).sort((a, b) => b.position - a.position).map((role) => ({ id: role.id, name: role.name })) }];
  }
  if (!access.canPlay) return denied;
  switch (path) {
    case "/internal/state":
      return [session.view()];
    case "/internal/ticket":
      return [{ ticket: await signTicket(secret), url: `${publicUrl.replace(/^http/, "ws")}/live` }];
    case "/internal/command":
      await session.command(input.command as session.Command);
      return [session.view()];
    case "/internal/enqueue": {
      const voice = await voiceChannel(userId);
      const channelId = "error" in voice ? session.view().channelId : voice.channelId;
      if (!channelId) return ["error" in voice ? voice : { error: "notInVoice" }, 409];
      const items = input.items as session.QueueItem[] | undefined;
      if (items) return [await session.enqueue(channelId, items, userId)];
      const outcome = await enqueueInput(String(input.input), channelId, userId);
      return outcome ? [outcome.result] : [{ error: "noResults" }, 422];
    }
    case "/internal/search": {
      const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
      if (!query) return [[]];
      try {
        return [await searchSongs(query)];
      } catch (error) {
        console.error("music search", (error as Error).message);
        return [{ error: "searchFailed" }, 502];
      }
    }
    case "/internal/history":
      return [session.history()];
    case "/internal/playlists":
      if (request.method === "POST") return [{ id: session.createPlaylist(String(input.name), userId, String(input.ownerName ?? "")) }];
      return [session.playlists()];
    case "/internal/playlist/tracks":
      return [session.playlistTracks(url.searchParams.get("id") ?? "")];
    case "/internal/playlist/rename":
      return session.renamePlaylist(id, userId, String(input.name)) ? [{ ok: true }] : denied;
    case "/internal/playlist/delete":
      return session.deletePlaylist(id, userId) ? [{ ok: true }] : denied;
    case "/internal/playlist/add": {
      const items = (input.items as session.QueueItem[] | undefined) ?? (await resolveInput(String(input.input), session.expand));
      const named = items.map((item) => ({ query: item.query, title: [item.artist, item.title ?? session.displayName(item.query)].filter(Boolean).join(" - ") }));
      return session.addToPlaylist(id, userId, named) ? [{ added: named.length }] : denied;
    }
    case "/internal/playlist/remove":
      return session.removeFromPlaylist(id, userId, String(input.trackId)) ? [{ ok: true }] : denied;
    case "/internal/playlist/move":
      return session.movePlaylistTrack(id, userId, String(input.trackId), Number(input.to)) ? [{ ok: true }] : denied;
  }
  return [{ error: "notFound" }, 404];
}

const sockets = new WebSocketServer({ noServer: true });

export const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://dj");
  if (url.pathname === "/healthz") return reply(response, { ok: true });
  if (!url.pathname.startsWith("/internal/") || request.headers.authorization !== `Bearer ${secret}`) return reply(response, { error: "notFound" }, 404);
  try {
    const [value, status] = await internal(request, url);
    reply(response, value, status);
  } catch (error) {
    console.error("api", url.pathname, (error as Error).message);
    reply(response, { error: "failed" }, 500);
  }
});

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://dj");
  if (url.pathname !== "/live" || !(await verifyTicket(url.searchParams.get("ticket") ?? "", secret))) {
    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    return;
  }
  sockets.handleUpgrade(request, socket, head, (live) => {
    const stop = session.watch((view) => live.send(JSON.stringify(view)));
    live.on("close", stop);
    live.on("error", stop);
    live.send(JSON.stringify(session.view()));
  });
});
