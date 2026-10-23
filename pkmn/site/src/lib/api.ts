import type * as z from "zod";

export class ApiError extends Error {}

export async function api<T extends z.ZodType>(path: string, schema: T, init?: { method?: string; body?: unknown }): Promise<z.infer<T>> {
  const response = await fetch(`/api${path}`, {
    method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
    headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof json === "object" && json !== null && "error" in json ? String(json.error) : response.statusText;
    throw new ApiError(message || `Request failed (${response.status})`);
  }
  return schema.parse(json);
}

const stallMs = 30_000;

export function putPart(url: string, body: Blob, onProgress: (loaded: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const request = new XMLHttpRequest();
    let stalled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const watch = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        request.abort();
      }, stallMs);
    };
    const cancel = () => request.abort();
    signal.addEventListener("abort", cancel, { once: true });
    const settle = () => {
      clearTimeout(watchdog);
      signal.removeEventListener("abort", cancel);
    };
    request.open("PUT", url);
    request.upload.onprogress = (event) => {
      watch();
      onProgress(event.loaded);
    };
    request.onload = () => {
      settle();
      if (request.status < 200 || request.status >= 300) return reject(new ApiError(`The file store refused the upload (${request.status})`));
      const etag = request.getResponseHeader("ETag");
      if (etag) resolve(etag);
      else reject(new ApiError("The file store hid the part's ETag"));
    };
    request.onerror = () => {
      settle();
      reject(new ApiError("The upload could not reach the file store"));
    };
    request.onabort = () => {
      settle();
      reject(stalled ? new ApiError("The upload stalled") : signal.reason);
    };
    watch();
    request.send(body);
  });
}
