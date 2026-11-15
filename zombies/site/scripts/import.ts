import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { runImportSchema } from "../shared/runs.js";
import { requireEnv } from "../api/_lib/env.js";

const [dir, ...pairs] = process.argv.slice(2);
if (!dir || pairs.some((pair) => !/^[^=]+=[^=]+$/.test(pair))) {
  console.error("usage: npm run import -- <map dir> <name>=<discord id> ...");
  process.exit(1);
}

const fileSchema = runImportSchema.extend({ members: z.array(z.object({ name: z.string().trim().min(1), discordId: z.string().min(1).optional() })).min(1) });
const file = resolve(process.env.INIT_CWD ?? process.cwd(), dir, "import.json");
const parsed = fileSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const given = new Map(pairs.map((pair) => pair.split("=") as [string, string]));
const members = parsed.data.members.map((member) => ({ name: member.name, discordId: given.get(member.name) ?? member.discordId }));
const missing = members.filter((member) => !member.discordId).map((member) => member.name);
if (missing.length) {
  console.error(`no Discord ID for: ${missing.join(", ")}`);
  process.exit(1);
}

const response = await fetch(`${requireEnv("ZOMBIES_URL")}/api/claude/runs`, {
  method: "POST",
  headers: { authorization: `Bearer ${requireEnv("CLAUDE_TOKEN")}`, "content-type": "application/json" },
  body: JSON.stringify({ ...parsed.data, members }),
});
const reply = (await response.json().catch(() => null)) as { id?: string; counts?: Record<string, number>; error?: string; issues?: string[] } | null;
if (!response.ok || !reply?.id) {
  console.error(`import failed: ${response.status} ${reply?.error ?? ""}`);
  for (const issue of reply?.issues ?? []) console.error(issue);
  process.exit(1);
}
console.log(
  `${parsed.data.game}/${parsed.data.map}: run ${reply.id}, ${Object.entries(reply.counts ?? {})
    .map(([name, n]) => `${name} ${n}`)
    .join(", ")}`,
);
