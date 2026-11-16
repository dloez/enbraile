import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requireEnv } from "../api/_lib/env.js";

const id = process.argv[2];

async function claude<T>(path: string): Promise<T> {
  const response = await fetch(`${requireEnv("ZOMBIES_URL")}/api/claude/${path}`, { headers: { authorization: `Bearer ${requireEnv("CLAUDE_TOKEN")}` } });
  if (!response.ok) {
    console.error(`read failed: ${response.status}`);
    process.exit(1);
  }
  return (await response.json()) as T;
}

type Listed = { id: string; game: string; map: string; language: string; startedBy: string; createdAt: string; lastLineAt: string | null; members: string[]; counts: Record<string, number> };

if (!id) {
  const { runs } = await claude<{ runs: Listed[] }>("runs");
  if (!runs.length) console.log("no runs");
  for (const run of runs)
    console.log(
      `${run.id}  ${run.game}/${run.map}  ${run.language}  started ${run.createdAt.slice(0, 16)}  last line ${run.lastLineAt?.slice(0, 16) ?? "-"}  ${run.members.join(", ")}  ${Object.entries(run.counts)
        .map(([name, n]) => `${name} ${n}`)
        .join(", ")}`,
    );
} else {
  const { call: _, ...log } = await claude<{ run: { game: string; map: string } } & Record<string, unknown>>(`runs/${encodeURIComponent(id)}`);
  const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../maps", log.run.game, log.run.map, "runs", `${id}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(log, null, 2)}\n`);
  const counts = Object.entries(log)
    .filter(([, value]) => Array.isArray(value))
    .map(([name, value]) => `${name} ${(value as unknown[]).length}`);
  console.log(`${relative(process.env.INIT_CWD ?? process.cwd(), file)}: ${counts.join(", ")}`);
}
