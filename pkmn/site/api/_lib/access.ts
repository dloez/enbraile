import { createMiddleware } from "hono/factory";
import { auth } from "./auth.js";
import { says } from "./i18n.js";

const t = says({
  en: {
    signIn: "Sign in first",
    waiting: "Waiting for an admin",
  },
  es: {
    signIn: "Inicia sesión primero",
    waiting: "A la espera de un administrador",
  },
});

export const requireAllowed = createMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/api/auth/")) return next();
  if (c.req.path.startsWith("/api/cron/")) return next();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: t(c).signIn }, 401);
  if (!session.user.admin && !session.user.allowed) return c.json({ error: t(c).waiting }, 403);
  await next();
});
