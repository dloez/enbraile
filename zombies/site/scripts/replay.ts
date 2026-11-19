import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { and, asc, eq, gt, max } from "drizzle-orm";
import { bundleSchema } from "../shared/bundle.js";
import { imageFacts } from "../shared/image.js";
import { runImportSchema } from "../shared/runs.js";
import { db } from "../api/_lib/db.js";
import { storeImage, storeVersion } from "../api/_lib/maps.js";
import { importRun, joinRun, postMessage, setVoice } from "../api/_lib/runs.js";
import { voices } from "../shared/voices.js";
import { coachTurn } from "../api/_lib/coach.js";
import { coachCalls, deliveries } from "../api/_lib/schema.js";

const [dir, recorded, label = "replay", voice] = process.argv.slice(2);
if (!dir || !recorded) {
  console.error("usage: npm run replay -- <map dir> <recorded run id> [label] [voice]");
  process.exit(1);
}
if (!process.env.DATABASE_URL?.includes("localhost")) {
  console.error("replay writes runs: point DATABASE_URL at the local database");
  process.exit(1);
}

const root = resolve(process.env.INIT_CWD ?? process.cwd(), dir);
const bundle = bundleSchema.parse(JSON.parse(await readFile(join(root, "bundle.json"), "utf8")));
for (const image of [bundle.image, bundle.survey]) {
  if (!image) continue;
  const bytes = await readFile(join(root, image.file));
  const facts = imageFacts(bytes);
  if (!facts || createHash("sha256").update(bytes).digest("hex") !== image.digest) throw new Error(`${image.file}: changed since compile`);
  await storeImage(image.digest, facts.type, bytes);
}
await storeVersion(bundle, "claude");

type Logged = { id: number; author: string; kind: string; spoken?: boolean; discordId: string | null; name: string; text: string; postedBy: string | null };
const log = JSON.parse(await readFile(join(root, "runs", `${recorded}.json`), "utf8")) as { members: { discordId: string; name: string }[]; messages: Logged[] };
const members = [...new Map(log.members.map((member) => [member.discordId, { discordId: member.discordId, name: member.name }])).values()];
const imported = await importRun(runImportSchema.parse({ ...JSON.parse(await readFile(join(root, "import.json"), "utf8")), members }));
if ("error" in imported) throw new Error(`import failed: ${imported.error}`);
const runId = imported.id;
if (voice) {
  const chosen = voices.find((entry) => entry === voice);
  if (!chosen) throw new Error(`no voice ${voice}: ${voices.join(", ")}`);
  await setVoice(runId, chosen);
}
const lines = log.messages.filter((message) => message.author === "member" && message.kind === "chat" && message.discordId);

const joined = new Set<string>();
const turns = [];
for (const line of lines) {
  const viewer = { discordId: line.discordId!, name: line.name, image: null };
  if (!joined.has(viewer.discordId)) {
    await joinRun(viewer, runId);
    joined.add(viewer.discordId);
  }
  const [delivered] = await db.select({ last: max(deliveries.id) }).from(deliveries).where(eq(deliveries.runId, runId));
  const [called] = await db.select({ last: max(coachCalls.id) }).from(coachCalls).where(eq(coachCalls.runId, runId));
  const started = performance.now();
  const heard = { first: null as number | null, said: "" };
  await postMessage(viewer, runId, line.text, line.spoken ?? true);
  const posted = performance.now();
  await coachTurn(runId, viewer, { kind: "message", spoken: true }, (event) => {
    if (event.type !== "text") return;
    heard.first ??= performance.now() - started;
    heard.said += event.text;
  });
  const total = performance.now() - started;
  const hints = await db
    .select({ text: deliveries.text, step: deliveries.stepId, level: deliveries.level })
    .from(deliveries)
    .where(and(eq(deliveries.runId, runId), gt(deliveries.id, delivered?.last ?? 0)))
    .orderBy(asc(deliveries.id));
  const calls = await db
    .select({ latencyMs: coachCalls.latencyMs, inputTokens: coachCalls.inputTokens, cacheReadTokens: coachCalls.cacheReadTokens, outputTokens: coachCalls.outputTokens, violations: coachCalls.violations, dropped: coachCalls.dropped })
    .from(coachCalls)
    .where(and(eq(coachCalls.runId, runId), gt(coachCalls.id, called?.last ?? 0)))
    .orderBy(asc(coachCalls.id));
  turns.push({ line: line.id, asked: line.text, said: heard.said.trim(), hints, firstMs: heard.first, postMs: posted - started, totalMs: total, calls });
  console.log(`line ${line.id}: first words ${heard.first === null ? "-" : `${(heard.first / 1000).toFixed(1)}s`}, done ${(total / 1000).toFixed(1)}s, ${calls.length} calls, ${hints.length} hints${calls.some((call) => call.violations.length) ? `, violations ${calls.flatMap((call) => call.violations).join(" ")}` : ""}`);
}

const file = join(root, "replays", `${recorded}-${label}.json`);
await mkdir(dirname(file), { recursive: true });
await writeFile(file, `${JSON.stringify({ run: runId, recorded, label, model: process.env.COACH_MODEL || "default", voice: voice ?? "default", turns }, null, 2)}\n`);
const firsts = turns.map((turn) => turn.firstMs).filter((ms): ms is number => ms !== null);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
console.log(`${relative(process.env.INIT_CWD ?? process.cwd(), file)}: ${turns.length} turns, first words median ${(median(firsts) / 1000).toFixed(1)}s, done median ${(median(turns.map((turn) => turn.totalMs)) / 1000).toFixed(1)}s`);
process.exit(0);
