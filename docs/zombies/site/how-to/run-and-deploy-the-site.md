# How to Run and Deploy the Site

Run `zombies/site/` locally, publish a map to it, and get it to `zombies.enbraile.vip`. Why it is built this way is in [The Zombies Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- Docker with Compose, for the local Postgres.
- For production: access to the owner's Vercel team `dloez`, its Neon integration, the Cloudflare `enbraile.vip` zone and the owner's 1Password.

## Steps

### 1. Install

From `zombies/site/`:

```sh
npm install
```

`allowScripts` in `package.json` records the esbuild versions whose install scripts are approved, as in pkmn.

### 2. Start Postgres

```sh
docker compose -p zombies-site up -d --wait
```

It listens on port 5433, so it runs beside pkmn's on 5432; set `POSTGRES_PORT` to move it.

### 3. Configure

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Locally |
|----------|---------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5433/zombies` |
| `ROOT_URL` | `https://enbraile.vip`, read only when `DEV_USER_ID` is empty |
| `CLAUDE_TOKEN` | Any long random string, e.g. `openssl rand -hex 24`; the bearer token of Claude's `/api/claude/` routes |
| `ZOMBIES_URL` | Where `publish` sends bundles and `runs` reads runs: `http://localhost:8789` |
| `DEV_USER_ID` | One or more members, comma-separated, each `<id>` or `<id>:<name>` (e.g. `111:Marina,222:Teo`), to be signed in without the root site |
| `ANTHROPIC_API_KEY` | An Anthropic API key for Cari; without one she stays silent |
| `COACH_MODEL` | The model Cari runs on; `claude-haiku-5-5` when empty |
| `BOT_URL` | Where the bot's API is, for bringing Cari into a call and showing members by their current Discord names: `http://localhost:8080` for a local bot; without it the run page offers no call and members show under their stored names |
| `INTERNAL_SECRET` | The bot's `INTERNAL_SECRET`, the bearer token both ways between the site and the bot; any long random string, the same in the bot's `.env.local`, which sets `ZOMBIES_URL=http://localhost:8789` |

### 4. Migrate

```sh
npm run db:migrate
```

After changing `api/_lib/schema.ts`, write the next migration with `npm run db:generate -- --name <what>` and commit it.

### 5. Run it

In two terminals:

```sh
npm run dev:api
npm run dev
```

The page is at `http://localhost:5175`, the API at `http://localhost:8789`. A browser is the first member of `DEV_USER_ID` until it opens `http://localhost:5175/api/dev/sign-in/<id>`, which makes it that member; a second browser profile (or a Playwright context) signed in as another ID is a second member of the same run.

### 6. Publish a map

A real map's `bundle.json` is built first from the files the ee-coach skill prepared in its dir ([Research and dossier building → Compile and publish](../../../../.claude/skills/ee-coach/references/research.md#4-compile-and-publish)):

```sh
npm run compile -- ../maps/<game>/<map>/
```

It prints the counts of steps, ladders, rungs, Alts and knowledge entries, the size of the map's image (`no art` without one) and the count of zones with the survey image's size, or every error by file and line or step and rung, never the text. The test map has no prepare files; its `bundle.json` is written by hand. Then:

```sh
npm run publish -- test-map
```

The path is the map's dir, holding its `bundle.json`, relative to where the command is run; from `zombies/site/` a real map's is `../maps/<game>/<map>/`. When the bundle has an announcement or survey image it uploads each first and prints its size (`already stored` when the site has it); a file changed since `compile` stops it with a request to compile again. It then prints the version stored, or `unchanged` when the bundle equals the latest one, and every schema error when it is rejected. A new version also offers the questions Cari held on in runs that are still waiting for an answer, and `publish` says how many of those runs it answered at once ([The Zombies Site → Cari](../explanation/site.md#cari)). A bundle with an image needs a deployment that has the image route, so a map's first image is published after the code that shows it is in production; likewise a bundle with zones or a survey image is published only once the code that shows zones is in production.

### 7. Read a run

```sh
npm run runs
npm run runs -- <run id>
```

The first lists every run with its map, members and counts; the second writes the whole run (its log, the lines said in its call, gaps, feedback, marks and Claude calls) to `zombies/maps/<game>/<map>/runs/<id>.json`, gitignored, and prints only its counts. Both read `ZOMBIES_URL` and `CLAUDE_TOKEN`, as `publish` does.

To follow a run while it is played:

```sh
npm run watch -- <run id>
```

It prints one spoiler-free line per event (a line, a hint, a gap, a revision, a rating, a reply's audit findings, a step-in, a new version) and keeps every event with its text in `zombies/maps/<game>/<map>/runs/<id>.events.jsonl`, gitignored, until it is stopped. For production, the `watch-run` skill (`.claude/skills/watch-run/`) prefixes it with a `prod` wrapper that loads `ZOMBIES_URL` and `CLAUDE_TOKEN` from the untracked `.env.production.local` without printing them. Run it under `Monitor` from Claude Code, as the ee-coach skill's [Watch a run](../../../../.claude/skills/ee-coach/SKILL.md#watch-a-run-from-claude-code) does.

To post in a run as Cari, write the step-in to a JSON file in the map's gitignored dir (`{ "text": ..., "hint": { "step": ..., "part": null, "alt": null }, "gap": null }`, as [The Zombies Site → Map Bundles](../explanation/site.md#map-bundles) describes), then:

```sh
npm run say -- <run id> <file>
```

It prints the new line's and card's IDs, or the refusal's code.

To carry a session coached from the terminal over to the site, write the map dir's gitignored `import.json` from its `session.md` and `knowledge.md` in a subagent ([ee-coach → Move a terminal session to the site](../../../../.claude/skills/ee-coach/SKILL.md#move-a-terminal-session-to-the-site)), then:

```sh
npm run import -- ../maps/<game>/<map> <name>=<discord id> ...
```

Each member named in the file needs a Discord ID, from the file or from a `<name>=<discord id>` argument, which wins. It prints the new run's ID and counts only; check the run with `npm run runs -- <id>`. The terminal's conversation goes in after, from the dir's gitignored `history.json` (written in the same subagent), and once per run:

```sh
npm run import -- ../maps/<game>/<map> --history <run id>
```

### 8. Run the gate

```sh
npm run gate
```

### 9. Set up production (once)

This was done on 2026-11-15.

The Vercel project is `enbraile-zombies` (ID `prj_VYZlP7Ln4TfrWJAJzdqzafTbvzwD`), root directory `zombies/site`, framework Vite, Node 26, with the function in `fra1` from `vercel.json` and the function's `.vc-config.json`, written by `scripts/build-api.ts` and Deployment Protection on every deployment but the custom domain. Its database is the Neon project `zombies` (ID `silent-morning-44744308`, Frankfurt, `aws-eu-central-1`), made from the Vercel Marketplace as `npx vercel integration add neon --name zombies --meta region=fra1 --no-connect --no-env-pull`, since the Neon organization is managed by Vercel and refuses `neonctl projects create`; `--no-connect` keeps the integration from writing variables of its own. It holds the branches `main` (production) and `dev` (previews), each with the database `neondb`.

Set the project's environment variables, piping each secret in so it never reaches a command line:

| Variable | Production | Preview |
|----------|------------|---------|
| `DATABASE_URL` | `main`'s pooled connection string, with `sslmode=verify-full` | `dev`'s, the same way |
| `ROOT_URL` | `https://enbraile.vip` | the same |
| `CLAUDE_TOKEN` | the 1Password item "zombies claude token"'s value | unset |
| `ANTHROPIC_API_KEY` | the cluster's `discord-bot-enbraile` secret, as below | unset |
| `COACH_MODEL` | `claude-haiku-5-5` | unset |
| `BOT_URL` | the bot's address, as the DJ panel's | unset |
| `INTERNAL_SECRET` | the cluster's `discord-bot-enbraile` secret, as below | unset |

```sh
v=$(npx neonctl connection-string main --project-id silent-morning-44744308 --pooled | sed 's/sslmode=require/sslmode=verify-full/' | tr -d '\n')
printf %s "$v" | npx vercel env add DATABASE_URL --environment production --sensitive
unset v
```

and the same with `dev` for `--environment preview`. The value goes through a variable rather than a straight pipe because `vercel env add` reads its stdin before a piped `npx neonctl` has written anything. `DEV_USER_ID` stays unset in Vercel, so every deployment asks the root site who is signed in; `ZOMBIES_URL` belongs to the shell running `publish` and `runs`, not to the project.

Hand Cari's key from the cluster to Vercel the same way, never printing it:

```sh
kubectl -n dj get secret discord-bot-enbraile -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 -d | npx vercel env add ANTHROPIC_API_KEY production
```

and the bot's secret, which the bot checks on every call from the site and the site checks on every spoken line from the bot (set on 2026-11-15, with `BOT_URL`):

```sh
kubectl -n dj get secret discord-bot-enbraile -o jsonpath='{.data.INTERNAL_SECRET}' | base64 -d | npx vercel env add INTERNAL_SECRET production
```

Make Claude's token in 1Password and hand it to Vercel without printing it:

```sh
op item create --category password --title "zombies claude token" --generate-password=48,letters,digits
v=$(op read "op://Private/zombies claude token/password")
printf %s "$v" | npx vercel env add CLAUDE_TOKEN --environment production --sensitive
unset v
```

With the item in another vault, put that vault's name in place of `Private` here and in [step 10](#10-deploy).

`zombies.enbraile.vip` is on the project's domains (`npx vercel domains add zombies.enbraile.vip enbraile-zombies`). In Cloudflare's `enbraile.vip` zone, add a `CNAME` for `zombies` to the target Vercel names for it (`npx vercel api /v6/domains/zombies.enbraile.vip/config`, `recommendedCNAME`, `0cedcc0080c9a767.vercel-dns-017.com` on 2026-11-15), with the proxy off: a proxied record would be blocked during LaLiga matches ([The Zombies Site → Hosting](../explanation/site.md#hosting)). The [root site](../../../home/site/explanation/site.md) lists `https://zombies.enbraile.vip` in `trustedOrigins` (`home/site/api/_lib/auth.ts`), so its sign-in returns to the site.

### 10. Deploy

Push to `main`. The `zombies-site.yml` workflow deploys every push to `main` that touches `zombies/site/` to production, and another branch's push gets a preview, whose URL ends the workflow's run ([How to Deploy the Vercel Projects](../../../general/how-to/deploy-vercel-projects.md)). Vercel's build runs `npm run build && npm run db:migrate` (`buildCommand` in `vercel.json`) against that environment's `DATABASE_URL`, so a deploy migrates its own branch before it goes live, and a failed build migrates nothing.

Then publish the maps to production, with the token read from 1Password into the shell:

```sh
CLAUDE_TOKEN="$(op read 'op://Private/zombies claude token/password')" ZOMBIES_URL=https://zombies.enbraile.vip npm run publish -- test-map
```

### Inspect deployments and the database from the shell

From `zombies/site/`, after `npx vercel link --project enbraile-zombies` once (`.vercel/` is gitignored), the commands of [pkmn's table](../../../pkmn/site/how-to/run-and-deploy-the-site.md#inspect-deployments-and-the-database-from-the-shell) work with `enbraile-zombies` and `--project-id silent-morning-44744308` in place of pkmn's. `select count(*) from drizzle.__drizzle_migrations` on a branch shows how many migrations it has applied. A connection string carries its password: keep it out of commits and logs.

### 11. Roll back

Use Instant Rollback on the previous production deployment in the Vercel dashboard, or revert the commit and push, which redeploys. A migration is not rolled back: a schema change is undone by a new forward migration, and lost data comes back through Neon's point-in-time restore. A map's bundle is reverted by publishing the older bundle again.

## Verification

The maps page shows Harrow Station with a Test map tag and "No attempts yet". Locally, with two members in `DEV_USER_ID`, one opens Harrow Station's row and starts an attempt there, and the other opens its link (`/attempts/<id>`) or its row on the map's view, joins, and sees the first one's lines within 2 seconds. With `ANTHROPIC_API_KEY` set, asking Cari for a hint brings a card both see, and its More adds the next rung; the third rung of the lantern step shows its zone on the station's drawn plan under its text; `select step_id, rung, mentions, reveals from deliveries order by id` reads back what was given. Publishing it again prints `version 1, unchanged`. With `BOT_URL` and `INTERNAL_SECRET` set to a local bot, a member in a voice channel sees the voice panel at the rail's foot (a bar under the strip on a phone) with **Bring Cari in**, and a «cari» request posted to `/api/voice` with the secret, as the bot sends it, answers `{ reply }` with Cari's words and any hint, and shows the line and the card in the chat. In production, `curl -s -o /dev/null -w '%{http_code}' https://zombies.enbraile.vip/api/maps` answers `401` signed out, and a signed-in member sees the same page at `https://zombies.enbraile.vip`.
