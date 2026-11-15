import { server } from "./api.ts";
import { useTools } from "./assistant/index.ts";
import { registerCommands } from "./commands.ts";
import { client, ready } from "./discord.ts";
import { modules } from "./modules.ts";

const port = Number(process.env.PORT ?? 8080);

useTools(modules.flatMap((module) => module.tools ?? []));

server.listen(port, () => console.log("listening", port));
void client.login(process.env.DISCORD_BOT_TOKEN ?? "");
void ready.then(async () => {
  console.log("ready", client.user?.tag);
  await registerCommands().catch((error: Error) => console.error("commands", error.message));
  for (const module of modules) await module.start?.().catch((error: Error) => console.error("start", module.name, error.message));
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    for (const module of modules) module.stop?.();
    server.close();
    void client.destroy().finally(() => process.exit(0));
  });
}
