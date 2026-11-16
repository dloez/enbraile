import { requireEnv } from "../api/_lib/env.js";

const [game, map, ...rest] = (process.argv[2] ?? "").split("/");
if (!game || !map || rest.length) {
  console.error("usage: npm run unpublish -- <game>/<map>");
  process.exit(1);
}

const response = await fetch(`${requireEnv("ZOMBIES_URL")}/api/claude/maps/${encodeURIComponent(game)}/${encodeURIComponent(map)}`, {
  method: "DELETE",
  headers: { authorization: `Bearer ${requireEnv("CLAUDE_TOKEN")}` },
});
const reply = (await response.json().catch(() => null)) as { versions?: number; runs?: number; images?: number; error?: string } | null;
if (!response.ok || !reply || reply.error) {
  console.error(`unpublish failed: ${response.status} ${reply?.error ?? ""}`);
  process.exit(1);
}
console.log(`${game}/${map}: deleted, ${reply.versions} versions, ${reply.runs} runs, ${reply.images} images`);
