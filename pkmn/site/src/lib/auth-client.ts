import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { forgetEarly, takeEarly } from "@/lib/api";

function early(input: string | URL | Request, init?: RequestInit): Promise<Response> | undefined {
  if ((init?.method ?? "GET").toUpperCase() !== "GET") {
    forgetEarly();
    return undefined;
  }
  if (input instanceof Request) return undefined;
  const url = new URL(input, location.origin);
  return url.origin === location.origin ? takeEarly(url.pathname + url.search) : undefined;
}

export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: { customFetchImpl: (input, init) => early(input, init) ?? fetch(input, init) },
  plugins: [usernameClient(), inferAdditionalFields({ user: { admin: { type: "boolean", required: false }, allowed: { type: "boolean", required: false } } })],
});
