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

export function putFile(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new ApiError(`The file store refused the upload (${request.status})`));
    request.onerror = () => reject(new ApiError("The upload could not reach the file store"));
    request.send(file);
  });
}
