import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const output = ".vercel/output";
const func = `${output}/functions/api.func`;

await rm(output, { recursive: true, force: true });
await mkdir(func, { recursive: true });

await build({
  entryPoints: { index: "api/_lib/handler.ts" },
  bundle: true,
  splitting: true,
  minify: true,
  platform: "node",
  format: "esm",
  target: "node26",
  outdir: func,
  outExtension: { ".js": ".mjs" },
  chunkNames: "chunks/[name]-[hash]",
  legalComments: "none",
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  logLevel: "warning",
});

await writeFile(
  `${func}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs26.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, supportsResponseStreaming: true, regions: ["fra1"] }),
);

await cp("dist", `${output}/static`, { recursive: true });

await writeFile(
  `${output}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [
      { handle: "filesystem" },
      { src: "^/api/(.*)$", dest: "/api", check: true },
      { src: "^/((?!assets/).*)$", dest: "/index.html", check: true },
    ],
  }),
);
