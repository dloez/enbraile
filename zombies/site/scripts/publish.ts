import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bundleSchema } from "../shared/bundle.js";
import { requireEnv } from "../api/_lib/env.js";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: npm run publish -- <map dir>");
  process.exit(1);
}

const file = resolve(process.env.INIT_CWD ?? process.cwd(), dir, "bundle.json");
const parsed = bundleSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const { game, map } = parsed.data;
const response = await fetch(`${requireEnv("ZOMBIES_URL")}/api/claude/maps/${game}/${map}`, {
  method: "PUT",
  headers: { authorization: `Bearer ${requireEnv("CLAUDE_TOKEN")}`, "content-type": "application/json" },
  body: JSON.stringify(parsed.data),
});
const reply = (await response.json().catch(() => null)) as { version?: number; created?: boolean; error?: string; issues?: string[] } | null;
if (!response.ok || !reply?.version) {
  console.error(`publish failed: ${response.status} ${reply?.error ?? ""}`);
  for (const issue of reply?.issues ?? []) console.error(issue);
  process.exit(1);
}
console.log(`${game}/${map}: version ${reply.version}${reply.created ? "" : ", unchanged"}`);
