import { readFile } from "node:fs/promises";
import { requireEnv } from "../api/_lib/env.js";

const [id, file] = process.argv.slice(2);
if (!id || !file) {
  console.error("usage: npm run say -- <run id> <step-in json file>");
  process.exit(1);
}

const body = await readFile(file, "utf8");
const response = await fetch(`${requireEnv("ZOMBIES_URL")}/api/claude/runs/${encodeURIComponent(id)}/say`, {
  method: "POST",
  headers: { authorization: `Bearer ${requireEnv("CLAUDE_TOKEN")}`, "content-type": "application/json" },
  body,
});
const result = (await response.json().catch(() => ({}))) as { message?: number; card?: number | null; error?: string; issues?: string[] };
if (!response.ok) {
  console.error(`say: refused, ${result.error ?? response.status}`);
  for (const issue of result.issues ?? []) console.error(`  ${issue}`);
  process.exit(1);
}
console.log(`said: cari line ${result.message}${result.card ? ` with card ${result.card}` : ""}`);
