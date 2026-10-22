import type { BetterAuthPlugin, User } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

export function devSignIn() {
  return {
    id: "dev-sign-in",
    endpoints: {
      devSignIn: createAuthEndpoint(
        "/dev/sign-in",
        { method: "GET", query: z.object({ username: z.string().min(1) }) },
        async (ctx) => {
          const user = await ctx.context.adapter.findOne<User & { admin: boolean }>({
            model: "user",
            where: [{ field: "username", value: ctx.query.username.toLowerCase() }],
          });
          if (!user || user.admin) throw new APIError("NOT_FOUND", { message: "No test player by that name" });
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect("/");
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
