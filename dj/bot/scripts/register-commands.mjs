const { DISCORD_APPLICATION_ID: app, DISCORD_BOT_TOKEN: token } = process.env;
const guild = "757377019536211988";
const es = (name, description) => ({ description, description_localizations: { "es-ES": name, "es-419": name } });
const commands = [
  { name: "play", ...es("Busca o reproduce un enlace", "Search or play a link"), options: [{ type: 3, name: "query", required: true, ...es("Nombre o enlace", "Name or link") }] },
  { name: "queue", ...es("Muestra la cola", "Show the queue") },
  { name: "skip", ...es("Salta el tema", "Skip the track") },
  { name: "pause", ...es("Pausa", "Pause") },
  { name: "resume", ...es("Continúa", "Resume") },
  { name: "stop", ...es("Para y sale del canal", "Stop and leave the channel") },
  { name: "shuffle", ...es("Mezcla la cola", "Shuffle the queue") },
  { name: "seek", ...es("Salta a un momento", "Jump to a time"), options: [{ type: 3, name: "time", required: true, ...es("Como 1:30", "Like 1:30") }] },
  { name: "volume", ...es("Cambia el volumen", "Change the volume"), options: [{ type: 4, name: "percent", required: true, min_value: 0, max_value: 200, ...es("De 0 a 200", "From 0 to 200") }] },
  { name: "loop", ...es("Repite", "Loop"), options: [{ type: 3, name: "mode", required: true, ...es("Modo", "Mode"), choices: [{ name: "off", value: "off" }, { name: "track", value: "track" }, { name: "queue", value: "queue" }] }] },
  { name: "autoplay", ...es("Sigue con temas parecidos", "Keep going with related tracks"), options: [{ type: 3, name: "mode", required: true, ...es("Modo", "Mode"), choices: [{ name: "on", value: "on" }, { name: "off", value: "off" }] }] },
  { name: "playlist", ...es("Listas", "Playlists"), options: [{ type: 1, name: "play", ...es("Pon una lista", "Play a playlist"), options: [{ type: 3, name: "name", required: true, autocomplete: true, ...es("Nombre de la lista", "Playlist name") }] }] },
].map((command) => ({ ...command, dm_permission: false }));
const headers = { authorization: `Bot ${token}`, "content-type": "application/json", "user-agent": "DiscordBot (https://dj.enbraile.vip, 1)" };
const put = await fetch(`https://discord.com/api/v10/applications/${app}/guilds/${guild}/commands`, { method: "PUT", headers, body: JSON.stringify(commands) });
const result = await put.json();
console.log("commands", put.status, Array.isArray(result) ? result.map((command) => command.name).join(" ") : JSON.stringify(result).slice(0, 400));
const patch = await fetch("https://discord.com/api/v10/applications/@me", { method: "PATCH", headers, body: JSON.stringify({ interactions_endpoint_url: "https://dj-bot.dloez.workers.dev/interactions" }) });
const body = await patch.json();
console.log("endpoint", patch.status, body.interactions_endpoint_url ?? JSON.stringify(body).slice(0, 400));
