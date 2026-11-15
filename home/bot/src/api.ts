import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import type { Module } from "./module.ts";
import { modules } from "./modules.ts";
import { secret, verifyTicket } from "./ticket.ts";

const BEAT_MS = 10_000;

const byName = new Map<string, Module>(modules.map((module) => [module.name, module]));

function reply(response: ServerResponse, value: unknown, status = 200): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return chunks.length ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>) : {};
}

function target(pathname: string): { module: Module; path: string } | null {
  const [, name = "", ...rest] = pathname.split("/");
  const module = byName.get(name);
  return module ? { module, path: rest.join("/") } : null;
}

const sockets = new WebSocketServer({ noServer: true });

export const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://bot");
  if (url.pathname === "/healthz") return reply(response, { ok: true });
  const found = target(url.pathname);
  if (!found?.module.route || request.headers.authorization !== `Bearer ${secret}`) return reply(response, { error: "notFound" }, 404);
  try {
    const method = request.method === "POST" ? "POST" : "GET";
    const input = method === "POST" ? await body(request) : {};
    const userId = String(input.userId ?? url.searchParams.get("userId") ?? "");
    const [value, status] = await found.module.route(method, found.path, url.searchParams, input, userId);
    reply(response, value, status);
  } catch (error) {
    console.error("api", url.pathname, (error as Error).message);
    reply(response, { error: "failed" }, 500);
  }
});

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://bot");
  const found = target(url.pathname);
  const peer = found?.path === "connect" && found.module.connect && request.headers.authorization === `Bearer ${secret}` ? found.module : null;
  if (peer) {
    sockets.handleUpgrade(request, socket, head, (connected) => peer.connect!(connected));
    return;
  }
  const module = found?.path === "live" && found.module.live && found.module.route ? found.module : null;
  const userId = module ? await verifyTicket(module.name, url.searchParams.get("ticket") ?? "") : null;
  if (!module || !userId) {
    socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    return;
  }
  sockets.handleUpgrade(request, socket, head, (live) => {
    const send = (message: unknown) => {
      if (live.readyState === live.OPEN) live.send(JSON.stringify(message));
    };
    let alive = true;
    live.on("pong", () => (alive = true));
    const beat = setInterval(() => {
      if (!alive) return live.terminate();
      alive = false;
      live.ping();
      send({ type: "beat" });
    }, BEAT_MS);
    let unwatch = () => undefined as void;
    const stop = () => {
      clearInterval(beat);
      unwatch();
    };
    live.on("close", stop);
    live.on("error", stop);
    live.on("message", async (data) => {
      let id: unknown;
      try {
        const message = JSON.parse(String(data)) as { id: unknown; method?: string; path?: string; body?: Record<string, unknown> };
        id = message.id;
        const url = new URL(`/${String(message.path ?? "")}`, "http://bot");
        const path = url.pathname.slice(1);
        if (path === "ticket") throw new Error("notFound");
        const [value, status] = await module.route!(message.method === "POST" ? "POST" : "GET", path, url.searchParams, message.body ?? {}, userId);
        send({ type: "reply", id, status: status ?? 200, body: value });
      } catch (error) {
        console.error("live", (error as Error).message);
        send({ type: "reply", id, status: 500, body: { error: "failed" } });
      }
    });
    unwatch = module.live!(userId, send);
  });
});
