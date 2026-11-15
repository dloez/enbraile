import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { bundleSchema } from "../shared/bundle.js";
import { requireEnv } from "../api/_lib/env.js";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: npm run publish -- <map dir>");
  process.exit(1);
}

const root = resolve(process.env.INIT_CWD ?? process.cwd(), dir);
const file = join(root, "bundle.json");
const parsed = bundleSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const { game, map, image } = parsed.data;
const base = requireEnv("ZOMBIES_URL");
const authorization = `Bearer ${requireEnv("CLAUDE_TOKEN")}`;

if (image) {
  const bytes = await readFile(join(root, image.file)).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== image.digest) {
    console.error(`${image.file}: missing or changed since compile; run compile again`);
    process.exit(1);
  }
  const sent = await fetch(`${base}/api/claude/images/${image.digest}`, { method: "PUT", headers: { authorization, "content-type": image.type }, body: bytes });
  const stored = (await sent.json().catch(() => null)) as { created?: boolean; error?: string } | null;
  if (!sent.ok) {
    console.error(`image upload failed: ${sent.status} ${stored?.error ?? ""}`);
    process.exit(1);
  }
  console.log(`${image.file}: ${image.width}x${image.height}${stored?.created ? "" : ", already stored"}`);
}

const response = await fetch(`${base}/api/claude/maps/${game}/${map}`, {
  method: "PUT",
  headers: { authorization, "content-type": "application/json" },
  body: JSON.stringify(parsed.data),
});
const reply = (await response.json().catch(() => null)) as { version?: number; created?: boolean; held?: { waiting: number; answered: number }; error?: string; issues?: string[] } | null;
if (!response.ok || !reply?.version) {
  console.error(`publish failed: ${response.status} ${reply?.error ?? ""}`);
  for (const issue of reply?.issues ?? []) console.error(issue);
  process.exit(1);
}
console.log(`${game}/${map}: version ${reply.version}${reply.created ? "" : ", unchanged"}`);
if (reply.held?.waiting) console.log(`held questions: ${reply.held.answered} of ${reply.held.waiting} waiting runs answered at once`);
