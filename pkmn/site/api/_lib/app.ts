import { Hono } from "hono";
import { auth } from "./auth.js";

export const app = new Hono().basePath("/api");

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));
