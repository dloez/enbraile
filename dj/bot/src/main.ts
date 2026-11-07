import { client, ready } from "./client.ts";
import { server } from "./api.ts";
import "./discord.ts";
import { resumeAfterRestart, snapshot } from "./session.ts";

const port = Number(process.env.PORT ?? 8080);

server.listen(port, () => console.log("listening", port));
void client.login(process.env.DISCORD_BOT_TOKEN ?? "");
void ready.then(() => {
  console.log("ready", client.user?.tag);
  return resumeAfterRestart();
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    snapshot();
    server.close();
    void client.destroy().finally(() => process.exit(0));
  });
}
