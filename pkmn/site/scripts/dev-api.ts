import { serve } from "@hono/node-server";
import { app } from "../api/_lib/app.js";

serve({ fetch: app.fetch, port: Number(process.env.API_PORT || 8787) }, (info) => {
  console.log(`API on http://localhost:${info.port}`);
});
