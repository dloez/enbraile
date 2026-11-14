import { existsSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const host = dirname(dirname(fileURLToPath(import.meta.url)));
const modules = ["../../dj/bot"];

for (const module of modules) {
  const root = join(host, module);
  if (!existsSync(root)) continue;
  const link = join(root, "node_modules");
  if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) rmSync(link, { recursive: true, force: true });
  symlinkSync(relative(root, join(host, "node_modules")), link);
  console.log("linked", relative(host, link));
}
