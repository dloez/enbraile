# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/site: remove Cloudflare from the site

Once `pkmn.enbraile.vip` has stayed up through a match, drops the Worker, Wrangler and `@cloudflare/vite-plugin`, and closes the move. See [Vercel Hosting: Discovery](vercel-hosting-discovery.md#surfaces-changed).

**Do:**
- [ ] Owner, first: during a LaLiga match, open `https://pkmn.enbraile.vip` from a Spanish ISP (Movistar, Digi, Orange or Vodafone) without a VPN; it must load.
- [ ] Remove `cloudflare()` and its import from `vite.config.ts`; uninstall `@cloudflare/vite-plugin` and `wrangler`; drop the `deploy` script and the `workerd` entry under `allowScripts`; delete `wrangler.jsonc`; drop `.wrangler/` and `.dev.vars*` from `.gitignore`.
- [ ] Owner: delete the `pkmn-site` Worker and disconnect Workers Builds in the Cloudflare dashboard.
- [ ] Remove `@cloudflare/vite-plugin` and `wrangler` from [The pkmn Site](../pkmn/site/explanation/site.md)'s Stack, drop the Wrangler prerequisite and manual deploy from the how-to, then move this scope's lasting content into the site doc and delete `vercel-hosting-discovery.md` with its rows in `docs/work-in-progress/index.md` and `docs/index.md`.

**Acceptance:**
- Claude-run: `npm run gate` and `npm run build` pass from `pkmn/site/`; `dist/` holds no `wrangler.json` or `.assetsignore`; `npm outdated` is empty; `grep -rniE "cloudflare|wrangler|workerd" pkmn/site --exclude-dir=node_modules --exclude-dir=dist` finds nothing; `grep -rn "vercel-hosting-discovery" docs` finds nothing.
- Human-run: the Cloudflare dashboard lists no `pkmn-site` Worker; a push to `main` touching `pkmn/site/` still deploys to `pkmn.enbraile.vip`; `/open-sheet` reloads fine.
- Reuse: none.
- Neighbors: none.
- Forbidden: replacing the plugin with another host-specific Vite plugin, and a fallback Worker kept around.

**Touches:** `pkmn/site/vite.config.ts`, `pkmn/site/package.json`, `pkmn/site/package-lock.json`, `pkmn/site/wrangler.jsonc`, `pkmn/site/.gitignore`, `docs/pkmn/site/`, `docs/work-in-progress/vercel-hosting-discovery.md`, `docs/work-in-progress/index.md`, `docs/index.md`
