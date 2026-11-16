const requestContext = Symbol.for("@vercel/request-context");

type RequestContext = { get?: () => { waitUntil?: (promise: Promise<unknown>) => void } | undefined };

export function bot(path: string, timeoutMs: number, init?: { method: "POST"; body: unknown }): Promise<Response> | null {
  const url = process.env.BOT_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!url || !secret) return null;
  return fetch(`${url.replace(/\/$/, "")}/zombies/${path}`, {
    method: init?.method ?? "GET",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export function inBackground(promise: Promise<unknown>): void {
  (globalThis as { [requestContext]?: RequestContext })[requestContext]?.get?.()?.waitUntil?.(promise);
}
