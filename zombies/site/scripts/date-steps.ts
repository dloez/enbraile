import { requireEnv } from "../api/_lib/env.js";

const id = process.argv[2];
if (!id || process.argv.length > 3) {
  console.error("usage: npm run date-steps -- <run id>");
  process.exit(1);
}

const response = await fetch(`${requireEnv("ZOMBIES_URL")}/api/claude/runs/${encodeURIComponent(id)}/date-steps`, {
  method: "POST",
  headers: { authorization: `Bearer ${requireEnv("CLAUDE_TOKEN")}` },
});
const reply = (await response.json().catch(() => null)) as { earlier?: number; dated?: number; error?: string } | null;
if (!response.ok || typeof reply?.dated !== "number") {
  console.error(`date-steps failed: ${response.status} ${reply?.error ?? ""}`);
  process.exit(1);
}
console.log(`${id}: ${reply.dated} of ${reply.earlier} steps done earlier dated from the chat`);
