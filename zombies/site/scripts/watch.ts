import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requireEnv } from "../api/_lib/env.js";
import type { RunEvent, RunEvents } from "../shared/runs.js";

const id = process.argv[2];
if (!id) {
  console.error("usage: npm run watch -- <run id>");
  process.exit(1);
}

const pollMs = 2000;
const base = requireEnv("ZOMBIES_URL");
const authorization = `Bearer ${requireEnv("CLAUDE_TOKEN")}`;

async function read(after: string): Promise<RunEvents | number> {
  const response = await fetch(`${base}/api/claude/runs/${encodeURIComponent(id!)}/events?after=${after}`, { headers: { authorization } }).catch(() => null);
  if (!response?.ok) return response?.status ?? 0;
  return (await response.json()) as RunEvents;
}

function line(event: RunEvent): string {
  const at = new Date(event.at).toLocaleTimeString("en-GB", { hour12: false });
  switch (event.kind) {
    case "line":
      return `${at} line ${event.name}`;
    case "coach":
      return `${at} coach${event.by ? ` (${event.by})` : ""}${event.cards.length ? ` with card ${event.cards.join(", ")}` : ""}`;
    case "audit":
      return `${at} audit ${event.message === null ? "on a reply never posted" : `on coach line ${event.message}`}: ${event.findings.join(", ")}`;
    case "hint":
      return `${at} hint on card ${event.card}, version ${event.version}`;
    case "revision":
      return `${at} revision ${event.id} from ${event.name}`;
    case "rating":
      return `${at} rating ${event.rating} from ${event.name} on card ${event.card}`;
    case "gap":
      return `${at} gap ${event.id} held`;
    case "answered":
      return `${at} gap ${event.gap} answered`;
    case "joined":
    case "left":
      return `${at} ${event.kind} ${event.name}`;
    case "progress":
      return `${at} progress ${event.status}`;
    case "published":
      return `${at} published version ${event.version}`;
  }
}

const first = await read("0");
if (typeof first === "number") {
  console.error(`watch: read failed: ${first}`);
  process.exit(1);
}
const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../maps", first.run.game, first.run.map, "runs", `${id}.events.jsonl`);
await mkdir(dirname(file), { recursive: true });
await writeFile(file, first.events.map((event) => `${JSON.stringify(event)}\n`).join(""));
console.log(`watching ${id} on ${first.run.game}/${first.run.map}: ${first.events.length} earlier events in ${relative(process.env.INIT_CWD ?? process.cwd(), file)}`);

let after = first.next;
let failing = false;
for (;;) {
  await new Promise((done) => setTimeout(done, pollMs));
  const page = await read(after);
  if (typeof page === "number") {
    if (!failing) console.log(`watch: read failed: ${page}, retrying`);
    failing = true;
    continue;
  }
  if (failing) console.log("watch: reading again");
  failing = false;
  if (!page.events.length) continue;
  await appendFile(file, page.events.map((event) => `${JSON.stringify(event)}\n`).join(""));
  for (const event of page.events) console.log(line(event));
  after = page.next;
}
