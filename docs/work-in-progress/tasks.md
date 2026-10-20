# Tasks

The work queue, written by `/scope` or added directly, and worked with `/next-task` (one entry) or `/work-queue` (unattended). The top entry is the highest priority. Entries are identified by heading, never numbered. Each entry ends with its scheduling lines: `**Touches:**`, the repo-relative paths it will edit (a trailing `/` for a directory, `*` to run alone), and `**After:**`, the headings of entries that must land first, separated by `;` and left out when there are none. `/work-queue` runs entries side by side when their `**Touches:**` do not overlap. Marker lines come last: an entry marked `**Needs the author:**` waits on the owner and is skipped by unattended runs, and `**Attempted once:**` records a failed unattended pass.

One queue for every category and project; an entry's heading starts with its category or project (e.g. `pkmn/wonder: …`).

## pkmn/site: deploy the site to Vercel alongside Cloudflare

Adds a Vercel deployment of `pkmn/site/` on its `vercel.app` URL, with public branch previews. `pkmn.enbraile.vip` stays on the Worker for now. See [Vercel Hosting: Discovery](vercel-hosting-discovery.md#interfaces-and-integration) and [Dependencies and Ordering](vercel-hosting-discovery.md#dependencies-and-ordering).

**Do:**
- [ ] Add `pkmn/site/vercel.json` rewriting every path to `/index.html`.
- [ ] Owner: create the Vercel project from the GitHub repo with Root Directory `pkmn/site`, the Vite preset, production branch `main`, skipping deployments when the root directory is unchanged, and Vercel Authentication off for previews.
- [ ] In [The pkmn Site](../pkmn/site/explanation/site.md)'s Hosting and Deploys, note that Vercel also deploys every push while the move is under way.

**Acceptance:**
- Claude-run: `npm run gate` and `npm run build` pass from `pkmn/site/`; `dist/index.html` and `dist/assets/` exist; `vercel.json` holds only the SPA rewrite.
- Human-run: the production `*.vercel.app` URL serves the home page, and `/open-sheet` and `/team-analysis` load when typed into the address bar and reloaded. Push a branch that touches `pkmn/site/`, then open its Vercel preview URL in a private window that isn't logged into Vercel, and it loads. Push a commit that touches only `docs/`, and Vercel skips it. `pkmn.enbraile.vip` still serves from Cloudflare.
- Reuse: the existing `npm run build`; no Vercel-specific build script.
- Neighbors: `pkmn/site/wrangler.jsonc`'s `not_found_handling: "single-page-application"`, which this rewrite mirrors.
- Forbidden: `@vercel/*` packages, the Vercel CLI in `package.json`, tokens or `.vercel/` in the repo, and removing any Cloudflare file yet.

**Touches:** `pkmn/site/vercel.json`, `docs/pkmn/site/explanation/site.md`

## pkmn/site: serve pkmn.enbraile.vip from Vercel

Moves the domain from the Worker to the Vercel project, with a DNS-only record on Cloudflare DNS. See [Vercel Hosting: Discovery](vercel-hosting-discovery.md#interfaces-and-integration) (how the domain moves) and [Idempotency and Rollback](vercel-hosting-discovery.md#idempotency-and-rollback).

**Do:**
- [ ] Owner: add `pkmn.enbraile.vip` to the Vercel project; in Cloudflare, remove the `pkmn-site` Worker's custom domain; add a `CNAME` for `pkmn` to the target Vercel shows, as DNS only (grey cloud); wait for Vercel to show the domain valid with a certificate.
- [ ] Rewrite [The pkmn Site](../pkmn/site/explanation/site.md)'s Hosting and Deploys and its hosting decision (dated 2026-10-20, with the LaLiga reason), and change "a Cloudflare Workers backend may follow" to Vercel Functions.
- [ ] Rewrite [How to Run and Deploy the Site](../pkmn/site/how-to/run-and-deploy-the-site.md)'s deploy, roll-back and verification steps for Vercel, and update the Site row in `docs/pkmn/index.md` if it mentions hosting.

**Acceptance:**
- Claude-run: `dig +short pkmn.enbraile.vip` returns a Vercel `CNAME` target or Vercel IPs, with none in Cloudflare's `188.114.96.0/22` or `2a06:98c1::/32` ranges; `curl -sI https://pkmn.enbraile.vip` shows a `server: Vercel` header and a valid certificate; `grep -rniE "cloudflare|worker|wrangler" docs/pkmn` matches only DNS mentions and the decision's history.
- Human-run: open `https://pkmn.enbraile.vip` in the browser you already use it in, and the Open Sheet tabs and teams you imported before are still there. A push to `main` touching `pkmn/site/` shows up at `pkmn.enbraile.vip` (a new `/assets/index-*.js`).
- Reuse: the Vercel project from the previous entry; Cloudflare stays the DNS provider.
- Neighbors: none.
- Forbidden: a proxied (orange-cloud) record for `pkmn`, and moving the `enbraile.vip` nameservers.

**Touches:** `docs/pkmn/site/`, `docs/pkmn/index.md`
**After:** pkmn/site: deploy the site to Vercel alongside Cloudflare

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
**After:** pkmn/site: serve pkmn.enbraile.vip from Vercel
