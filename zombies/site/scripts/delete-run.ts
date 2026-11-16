import { requireEnv } from "../api/_lib/env.js";

const id = process.argv[2];
if (!id || process.argv.length > 3) {
  console.error("usage: npm run delete-run -- <run id>");
  process.exit(1);
}

const response = await fetch(`${requireEnv("ZOMBIES_URL")}/api/claude/runs/${encodeURIComponent(id)}`, {
  method: "DELETE",
  headers: { authorization: `Bearer ${requireEnv("CLAUDE_TOKEN")}` },
});
const reply = (await response.json().catch(() => null)) as { game?: string; map?: string; lines?: number; error?: string } | null;
if (reply?.error === "noSuchRun") {
  console.error(`${id}: noSuchRun`);
  process.exit(1);
}
if (!response.ok || !reply?.game) {
  console.error(`delete-run failed: ${response.status} ${reply?.error ?? ""}`);
  process.exit(1);
}
console.log(`${id}: deleted from ${reply.game}/${reply.map}, ${reply.lines} lines`);
