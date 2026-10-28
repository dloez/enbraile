import type * as z from "zod";
import { messages } from "../../shared/i18n";

const t = messages({
  en: {
    failed: (status: number) => `Request failed (${status})`,
    refused: (status: number) => `The file store refused the upload (${status})`,
    noEtag: "The file store hid the part's ETag",
    unreachable: "The upload could not reach the file store",
    stalled: "The upload stalled",
  },
  es: {
    failed: (status: number) => `La petición falló (${status})`,
    refused: (status: number) => `El almacén de archivos rechazó la subida (${status})`,
    noEtag: "El almacén de archivos ocultó el ETag de la parte",
    unreachable: "La subida no pudo llegar al almacén de archivos",
    stalled: "La subida se detuvo",
  },
});

export class ApiError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const earlyMs = 10_000;

const early = new Map<string, { at: number; response: Promise<Response> }>();

export function prefetch(path: string) {
  const url = `/api${path}`;
  const held = early.get(url);
  if (held && Date.now() - held.at < earlyMs) return;
  early.set(url, { at: Date.now(), response: fetch(url) });
}

export function forgetEarly() {
  early.clear();
}

export function takeEarly(url: string): Promise<Response> | undefined {
  const held = early.get(url);
  early.delete(url);
  return held && Date.now() - held.at < earlyMs ? held.response : undefined;
}

export async function api<T extends z.ZodType>(path: string, schema: T, init?: { method?: string; body?: unknown }): Promise<z.infer<T>> {
  const method = init?.method ?? (init?.body === undefined ? "GET" : "POST");
  if (method !== "GET") forgetEarly();
  const response = await ((method === "GET" ? takeEarly(`/api${path}`) : undefined) ??
    fetch(`/api${path}`, {
      method,
      headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    }));
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof json === "object" && json !== null && "error" in json ? String(json.error) : response.statusText;
    throw new ApiError(message || t.failed(response.status), response.status);
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
      if (request.status < 200 || request.status >= 300) return reject(new ApiError(t.refused(request.status)));
      const etag = request.getResponseHeader("ETag");
      if (etag) resolve(etag);
      else reject(new ApiError(t.noEtag));
    };
    request.onerror = () => {
      settle();
      reject(new ApiError(t.unreachable));
    };
    request.onabort = () => {
      settle();
      reject(stalled ? new ApiError(t.stalled) : signal.reason);
    };
    watch();
    request.send(body);
  });
}
