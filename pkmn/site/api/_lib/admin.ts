import { createMiddleware } from "hono/factory";
import { auth } from "./auth.js";

export const requireAdmin = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Sign in first" }, 401);
  if (!session.user.admin) return c.json({ error: "Admins only" }, 403);
  await next();
});
