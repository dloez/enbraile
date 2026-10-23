import { createMiddleware } from "hono/factory";
import { auth } from "./auth.js";

export const requireAllowed = createMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/api/auth/")) return next();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Sign in first" }, 401);
  if (!session.user.admin && !session.user.allowed) return c.json({ error: "Waiting for an admin" }, 403);
  await next();
});
