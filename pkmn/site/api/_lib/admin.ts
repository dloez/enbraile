import { createMiddleware } from "hono/factory";
import { auth } from "./auth.js";
import { says } from "./i18n.js";

const t = says({
  en: {
    signIn: "Sign in first",
    adminsOnly: "Admins only",
  },
  es: {
    signIn: "Inicia sesión primero",
    adminsOnly: "Solo para administradores",
  },
});

export const requireAdmin = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: t(c).signIn }, 401);
  if (!session.user.admin) return c.json({ error: t(c).adminsOnly }, 403);
  await next();
});
