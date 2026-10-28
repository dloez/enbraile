import type { Context } from "hono";
import { preferredLang, type Messages } from "../../shared/i18n.js";

export function says<E>(m: Messages<E>): (c: Context) => E {
  return (c) => m[preferredLang(c.req.header("cookie"), c.req.header("accept-language"))];
}
