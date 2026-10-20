# Vercel Hosting: Discovery

The decisions behind moving the [pkmn site](../pkmn/site/explanation/site.md) (`pkmn/site/`, `pkmn.enbraile.vip`) from a Cloudflare Worker to Vercel. Scoped with the owner on 2026-10-20.

## Goal and Success

**Q: Why move?**
A: In Spain, ISPs block Cloudflare IP ranges during LaLiga matches under a court order that runs through the 2026/27 season, and the site goes down with them. Vercel was blocked once, in April 2025. It was unblocked within days ([Vercel's update](https://vercel.com/blog/update-on-spain-and-laliga-blocks-of-the-internet)), and Vercel now works with LaLiga to take pirate streams down.
**Why:** the owner accepted the remaining risk (Vercel's IPs are still shared) over running a VPS with its own IP, in exchange for keeping managed push-to-deploy and previews. _(2026-10-20)_

**Q: When is it done?**
A: `pkmn.enbraile.vip` is served by Vercel and loads from a Spanish ISP during a LaLiga match. Pushes to `main` that touch `pkmn/site/` deploy to production, and branch pushes get public preview URLs. No Cloudflare Worker, Wrangler or `@cloudflare/vite-plugin` is left in the repo or the account.

## Scope Edges

**Q: What is out?**
A: Any backend or storage. The site stays static, and readers' data stays in their browser. When a backend comes, it will be Vercel Functions, with storage chosen then. DNS also stays out: `enbraile.vip` stays on Cloudflare DNS.

## Surfaces Changed

**Q: What changes in the code?**
A: `pkmn/site/` gets a `vercel.json` with a rewrite of every path to `/index.html` for the single-page app. Vercel serves real files first, so `/assets/*` is unaffected. These Cloudflare pieces are removed:
- `@cloudflare/vite-plugin` from `vite.config.ts` and `package.json`
- `wrangler`, the `deploy` script, the `workerd` entry under `allowScripts`, `wrangler.jsonc`, and the `.wrangler/` and `.dev.vars*` lines in `.gitignore`

`npm run build` then emits a plain static `dist/` with no `wrangler.json` in it.

**Q: What changes outside the repo?**
A: The owner does these by hand:
- Creates a Vercel project on their Hobby account.
- Moves the `pkmn` DNS record.
- Deletes the `pkmn-site` Worker and its Workers Builds connection.

## Dependencies and Ordering

**Q: In what order?**
A: Three steps, so the domain is never left without a working host:
1. Vercel deploys alongside Cloudflare, on its `vercel.app` URL only.
2. The domain switches to Vercel.
3. After a match-day check, Cloudflare is removed from the code and the account.

Until step 3, the Cloudflare files stay so that Workers Builds keeps succeeding.

## Data, Secrets and Config

**Q: Does readers' data survive the move?**
A: Yes. IndexedDB and `localStorage` are scoped to the origin, and `https://pkmn.enbraile.vip` doesn't change. Preview and `vercel.app` URLs are different origins, so they start empty, the same as `workers.dev` previews do today.

**Q: Secrets?**
A: None. Vercel's Git integration connects in the dashboard, and the repo holds no token.

## Interfaces and Integration

**Q: How do pushes deploy?**
A: Through Vercel's Git integration, connected to the GitHub repo in the owner's Vercel dashboard:
- Root Directory `pkmn/site`, with the Vite framework preset (`npm run build`, output `dist`)
- Deployments skipped when nothing under the root directory changed
- `main` as the production branch

**Why:** the owner chose it over a GitHub Action with the Vercel CLI. It mirrors Workers Builds and keeps tokens out of GitHub. _(2026-10-20)_

**Q: Are previews public?**
A: Yes. Vercel Authentication is turned off for preview deployments, so friends can open them without a Vercel account.
**Why:** the owner chose it, matching today's public `workers.dev` previews. _(2026-10-20)_

**Q: How does the domain move?**
A: The steps, in order:
1. Add `pkmn.enbraile.vip` to the Vercel project.
2. In Cloudflare, remove the Worker's custom domain. This deletes the proxied record it created.
3. Add a `CNAME` for `pkmn` to the target Vercel shows, as **DNS only** (grey cloud). Proxying it would put traffic back on Cloudflare's IPs.

Vercel then issues the certificate. Checked 2026-10-20: `enbraile.vip` has no CAA records, so nothing blocks Vercel's CA.

## Reuse

**Q: What is reused?**
A: The existing Vite build and `npm run gate`, unchanged. Vercel's Vite preset runs the same `npm run build`.

## Idempotency and Rollback

**Q: How is a bad deploy undone?**
A: Revert the commit and push, which redeploys. Or use Instant Rollback in Vercel; on Hobby it goes back to the previous production deployment. Before step 3, a failed cutover is undone by removing the `CNAME` and re-adding the Worker's custom domain.

**Q: What happens to the Worker?**
A: It's deleted once Vercel is verified, and Workers Builds is disconnected. It isn't kept as a fallback.
**Why:** the owner chose it. A dormant Worker would go stale as `main` moves on, and the repo is greenfield. _(2026-10-20)_

## Portability and Environment

**Q: Does local development change?**
A: `npm run dev` stays plain Vite. Without the Cloudflare plugin it no longer runs inside `workerd`, which only mattered for Worker code the site doesn't have.

## Observability

**Q: What replaces Cloudflare's analytics and logs?**
A: Vercel's build and deployment logs. Vercel Web Analytics is not added.
**Why:** the owner chose no analytics. The site keeps making no runtime calls besides Showdown's sprites. _(2026-10-20)_

## Verification

**Q: What is checked, and by whom?**
A: Claude runs `npm run gate` and `npm run build`, and greps for leftover Cloudflare references. The owner checks the rest by hand:
- the `vercel.app` and preview URLs, including a deep-link reload
- `pkmn.enbraile.vip` after the DNS switch, from a Spanish ISP during a LaLiga match without a VPN
- that the Worker is gone from the dashboard

## References

- [The pkmn Site](../pkmn/site/explanation/site.md): Hosting and Deploys, Decisions
- [How to Run and Deploy the Site](../pkmn/site/how-to/run-and-deploy-the-site.md)
- `pkmn/site/`: `vite.config.ts`, `package.json`, `wrangler.jsonc`, `.gitignore`, `CLAUDE.md`
- [Vercel: Update on Spain and LaLiga blocks of the internet](https://vercel.com/blog/update-on-spain-and-laliga-blocks-of-the-internet)
