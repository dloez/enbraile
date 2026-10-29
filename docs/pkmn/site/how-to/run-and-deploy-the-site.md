# How to Run and Deploy the Site

Run `pkmn/site/` locally, check it, and get a change to `pkmn.enbraile.vip`. Why it is built and hosted this way is in [The pkmn Site](../explanation/site.md).

## Prerequisites

- Node.js with npm.
- Docker with Compose, for the local Postgres and MinIO.
- For deploying, migrating production and rolling back: access to the owner's Vercel project and its Neon database.

## Steps

### 1. Install

From `pkmn/site/`:

```sh
npm install
```

`allowScripts` in `package.json` records which dependencies' install scripts are reviewed (esbuild's, approved per version); npm warns about any other until it is approved with `npm approve-scripts <pkg>` or denied with `npm deny-scripts <pkg>`.

### 2. Start the local stack

From `pkmn/site/`:

```sh
docker compose up -d --wait
```

`compose.yaml` runs Postgres (database `pkmn`, user and password `postgres`) on port 5432 and MinIO (user and password `minioadmin`) on 9000, with its console on 9001; a one-shot `bucket` service makes the `pkmn-site` bucket and exits. `--wait` returns once both are healthy. To run a second checkout beside it, set `COMPOSE_PROJECT_NAME`, `POSTGRES_PORT`, `MINIO_PORT` and `MINIO_CONSOLE_PORT` in the shell for every `docker compose` command, and match `DATABASE_URL` in step 3.

`docker compose down -v` stops it and deletes its data; step 3's commands then bring back a known state.

### 3. Set up the database

Copy `.env.example` to `.env.local` (untracked). Its values fit the local stack; fill in `BETTER_AUTH_SECRET`:

- `DATABASE_URL`: the Postgres connection string; the example's points at the local stack, or use the Neon `dev` branch's.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters, e.g. from `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: `http://localhost:5173`, the Vite dev URL.
- `API_PORT`: the port the API listens on behind Vite, 8787.
- `DEV_SIGN_IN`: `1` turns on the test sign-in ([How to Verify the Site](verify-the-site.md)). Set it only in a local `.env.local` and in Vercel's Preview environment, never in Production.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`: the Discord application's OAuth2 client (step 6). Left empty, Discord sign-in is not registered and its button answers "Sign-in failed"; the local stack signs players in with the test sign-in instead.
- `CRON_SECRET`: the secret the bucket's daily sweep answers to ([The pkmn Site → Data and Storage](../explanation/site.md#data-and-storage)). Left empty, `/api/cron/sweep-files` refuses every call; set it to try the sweep locally.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: the file store; the example's point at the local MinIO and its `pkmn-site` bucket. With a second stack's `MINIO_PORT`, match the port in `S3_ENDPOINT`.

Then apply the migrations and seed the known state:

```sh
npm run db:migrate
npm run seed
```

`seed` makes the admin `admin` with the password `admin-password`, the test players Red and Blue, allowed, and Leaf, waiting for an admin, the game "Pokémon Añil + Randomlocke" with a small stand-in zip put in the bucket, holding the game's item icons from `pkmn/games/anil/game/base/es-v4.14/Graphics/Items/` when [`anil install`](../../games/anil/how-to/install-the-game.md) has fetched the game, so its icon sheet is built as an upload's is, Series 1 running on it, on the daytime route, with Red and Blue as its players, eleven milestones, the rules of `docs/pkmn/series/1/reference/rules.md` and two league rounds, Red beating Blue 2–1 at Gym 1, its three games recorded through the match module, and Blue against Red to play at Gym 2 (skipped when series 1 has a round), a Pokémon League try of Red's with 2 combats won (skipped when Red has a try in series 1), on three fixed species with no team, and, when `pkmn/site/saves/` (gitignored) holds a save zip, a snapshot for Red from the first one, at the milestone its save suggests or else Hall of Fame, through the same pipeline as an upload, and beside it, at the milestone before, a copy of that snapshot with its last permafainted Pokémon alive again and an hour less play time, so Red's series page shows a Pokémon fallen between two milestones; it skips both when Red already has a snapshot. Then Series 2, finished, on the night sky, with Red and Blue as its players and the same milestones and rules, holding, when Red has a Series 1 snapshot, a copy of the latest at its Tournament with two hours more play time, so Red's profile sums two series, and its cup started with Red and Blue, their final to play; it skips Series 2 when it exists, and its cup when it has one. When that Tournament snapshot holds eight Pokémon or more, it also plays the final to game 2's bans: Blue gets a copy of the snapshot at Tournament, each final team is filled with its snapshot's first eight Pokémon and locked, in game 1 Red bans the first of Blue's eight and Blue the second of Red's, each brings the first six left, and Red wins it through the match module, so game 2's bans are open with Red barred from banning Blue's first again; it skips this when the final has a ban or a six. Red's locked cup team is then marked fixed by `admin` at the seed's time, so a team page shows an admin's fix; it skips this when that team is already marked. When Red has a Series 1 snapshot and no team, it also makes Red a "Seed team" of that snapshot's Pokémon that were the save's first three party members (the export shuffles them, so the seed reads the party from the zip). The seed refuses a `DATABASE_URL` or `S3_ENDPOINT` whose host is not `localhost` or `127.0.0.1`. To make a real admin instead, `npm run admin:create <name>` asks for the password twice; it refuses a name already taken and a password under 8 characters. Every script reads `.env.local`; a variable already set in the shell wins over it.

After changing `api/_lib/schema.ts`, write the next migration with `npm run db:generate`, check the migrations with `npx drizzle-kit check`, and commit the new files in `drizzle/`. A migration only goes forward: to undo a change, generate another.

### 4. Run it locally

```sh
npm run dev
```

Vite starts the API itself (`scripts/dev-api.ts` under `tsx watch`, on `API_PORT`, restarting on changes), proxies `/api` to it, prints the local URL, and stops the API when it stops. Every page but `/admin` asks a signed-out reader to sign in, and players sign in locally with the test sign-in ([How to Verify the Site](verify-the-site.md)). A signed-in player lands on the running series at `/series/<n>`, every series is at `/series`, a player's profile at `/players/<player id>` (the header's name opens one's own), their journey and fallen at `/players/<player id>/series/<n>`, their PC at `/players/<player id>/series/<n>/pc` (the header's PC tab opens one's own), a series' ability search at `/series/<n>/abilities`, the teams at `/teams` and each team at `/teams/<id>`, admins sign in at `/admin`, the allowlist is at `/admin/players`, the games are at `/admin/games` and the series are at `/admin/series`. A series page's Upload button takes a save zip as a snapshot.

### 5. Run the gate

```sh
npm run gate
```

It runs `tsc -b`, and must pass before a change is done; the site has no tests, so check a change by running it (step 4), driving it in a browser as [How to Verify the Site](verify-the-site.md) says.

### 6. Set up production (once)

In the Vercel dashboard, add Neon from the Vercel Marketplace (free tier) to the project, named `pkmn-site`, in the region `aws-eu-central-1` (Frankfurt), where `vercel.json` runs the function (`fra1`); in Neon keep a production branch and a `dev` branch. The integration may add its own `DATABASE_URL` and branch per preview: keep the variables as in the table below.

In Backblaze B2, make two private buckets in the same account, `pkmn-site-enbraile` for production and `pkmn-site-preview-enbraile` for previews, and for each an application key limited to that bucket, with read and write access. Give each bucket a CORS rule so browsers can upload to it and download from it straight: operations `s3_put`, `s3_get` and `s3_head`, headers `*`, exposed header `ETag`, max age 3600, allowed origin `https://pkmn.enbraile.vip` on the production bucket and `https://*.vercel.app` on the preview one, and nothing else. B2's web UI cannot save a custom origin, so set the rule with the CLI, signed in (`uvx b2 account authorize`) with that bucket's key:

```sh
uvx b2 bucket update --cors-rules '[{"corsRuleName":"pkmn-site","allowedOrigins":["https://pkmn.enbraile.vip"],"allowedOperations":["s3_head","s3_put","s3_get"],"allowedHeaders":["*"],"exposeHeaders":["ETag"],"maxAgeSeconds":3600}]' pkmn-site-enbraile
```

and the same with `https://*.vercel.app` for `pkmn-site-preview-enbraile`; `uvx b2 account clear` afterwards. A preflight `OPTIONS` to `https://s3.<region>.backblazeb2.com/<bucket>/x` with an `Origin` and `Access-Control-Request-Method: PUT` answers `200` for the allowed origin and `403` for any other. The buckets' S3 endpoint is shown on their page (`https://s3.<region>.backblazeb2.com`), and the region is the part after `s3.`.

In the [Discord Developer Portal](https://discord.com/developers/applications), make an application for the site. Under OAuth2, add the redirects `https://pkmn.enbraile.vip/api/auth/callback/discord` and `http://localhost:5173/api/auth/callback/discord`, and copy its client ID and client secret. Previews get no Discord sign-in: their URLs change with every branch, so they sign in as an admin or not at all.

Set the project's environment variables:

| Variable | Production | Preview |
|----------|------------|---------|
| `DATABASE_URL` | the production branch's pooled connection string, with `sslmode=verify-full` | the `dev` branch's, the same way |
| `BETTER_AUTH_SECRET` | a random secret | another random secret |
| `BETTER_AUTH_URL` | `https://pkmn.enbraile.vip` | unset |
| `S3_ENDPOINT`, `S3_REGION` | the buckets' endpoint and region | the same |
| `S3_BUCKET` | `pkmn-site-enbraile` | `pkmn-site-preview-enbraile` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | the production bucket's key ID and key | the preview bucket's |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | the Discord application's client ID and secret | unset |
| `CRON_SECRET` | a random secret of at least 16 characters, e.g. from `openssl rand -hex 32` | unset |

Neon's connection strings carry `sslmode=require`, which `pg` already treats as `verify-full` and warns about on every connection; write `sslmode=verify-full` in every Neon string, in Vercel and in the shell, which keeps the same certificate checks and silences the warning.

`API_PORT` stays unset in Vercel, and `DEV_SIGN_IN` is `1` in Preview alone, where Vercel's Deployment Protection (Vercel Authentication, on every deployment but the custom domain) keeps the previews to the team; without it, in Production, the test sign-in does not exist. Each branch is migrated by its environment's next deploy (step 7). Then make the admins with that branch's direct connection string (the one without `-pooler`) and its environment's `BETTER_AUTH_SECRET` set in the shell, since `admin:create` loads the site's auth setup, which refuses to start without one:

```sh
export DATABASE_URL='<the branch's direct connection string>'
export BETTER_AUTH_SECRET='<that environment's secret>'
npm run admin:create <name>
unset DATABASE_URL BETTER_AUTH_SECRET
```

### 7. Deploy

Push to `main`. Vercel's build runs `npm run build` and then `npm run db:migrate` (`buildCommand` in `vercel.json`) against that environment's `DATABASE_URL`, so a deploy migrates its own branch, production or `dev`, before it goes live, and a build that fails migrates nothing. A migration that drops or renames something the live code still reads goes out in two deploys: first the code that no longer reads it, then the migration. Vercel builds and deploys every push that touches `pkmn/site/` to production, and a branch push gets a public preview URL, shown on the commit's GitHub status and in the Vercel dashboard. There is no manual deploy command.

### Seed the preview

The preview deploys share the Neon `dev` branch and the `pkmn-site-preview-enbraile` bucket, and every preview build seeds them after migrating: `buildCommand` in `vercel.json` runs `npm run seed` with `SEED_TARGET=preview` when `VERCEL_ENV` is `preview`. The seed fills them with the local stack's data (the admin, the test players, the game with its stand-in zip, series 1 and series 2) and adds nothing it already holds, so later previews keep what reviewers did. The players' saves stay out of the repository (`pkmn/site/saves/` is ignored), so the build seeds no snapshot: upload them on the preview as its admin, from a trainer's row on `/series/1`. It runs in the build because the Preview variables are sensitive: `vercel env pull` hands them back blank.

The seed refuses any database or store off the local stack unless `SEED_TARGET` is `preview` and `S3_BUCKET` is the preview bucket, so the Production variables are never seeded, and off the local stack it takes the admin's password from `SEED_ADMIN_PASSWORD`, set for Preview in Vercel. That variable is sensitive: Vercel never shows it again, in the dashboard or the CLI, whose `vercel env pull` writes `[SENSITIVE]` in its place. The seed makes the admin only when there is none, so the preview database's admin keeps whatever password it was made or last reset with.

Push a branch for a preview URL (step 7) and open it in a browser signed in to Vercel, which Vercel Authentication asks for first. Then sign in on the preview:

- As a test player: open `/api/auth/dev/sign-in?username=red` (or `blue`, or `leaf`, who is still waiting for an admin), which signs in and lands on the site.
- As the admin: at `/admin`, the username `admin` and the preview admin's password, which the owner keeps; it was reset on 2026-10-25, since the one it was made with was no longer known. To reset it again, hash a new password with Better Auth's own hasher (`(await auth.$context).password.hash`, as `scripts/accounts.ts` does) and write it to the admin's `credential` row in `account` on the Neon `dev` branch, run with `DATABASE_URL` set to `npx neonctl connection-string dev --project-id wandering-pine-85287086`.

Discord sign-in does not work on a preview, whose URL is not among the Discord application's redirects. An agent's browser passes the protection with the project's Protection Bypass for Automation secret, read from `npx vercel api /v9/projects/enbraile-pkmn` (`protectionBypass`), by opening a preview URL once with `?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`.

### Import series 1's league

Series 1's rounds, results, matchday teams, Pokémon League tries and hatched eggs come across once from the Trainer League app's dump ([The pkmn Site → League](../explanation/site.md#league)). Unzip the dump the owner handed over into `pkmn/site/saves/league-export/` (gitignored), then from `pkmn/site/`:

```sh
npm run league-import
```

On the local stack or the preview, it makes the accounts Vicky, Dloez, Javi, Inop, Tole and Elfo as allowed test players where they are missing, adds them to series 1, replaces series 1's rounds, matches and Pokémon League tries with the dump's, makes a game of each replay from its Showdown log in the dump, a locked Any Pokémon team for each side of each match from what its replays show (its matchday paste where it has no replay; Elfo, with no team for the unplayed Elfo v Javi, gets his round team once his Gym 7 snapshot exists), and an Any Pokémon team of each try's paste, writes each player's hatched count from the app as an override that a snapshot they upload afterwards takes over, leaving alone a count an admin set, and prints what it wrote, the hatched counts and whose admin-set count it kept, the standings, any player whose points, wins, losses or games differ from the app's, anything a try's paste or a match team leaves out (nothing in the dump's: every try keeps its randomized abilities and moves), and any replay or match whose replays disagree with the app (today only round 3's Elfo v Dloez, whose fainted read 17–11 from its replays against the app's 0–0). Running it again replaces series 1's league with the dump's: every round and Pokémon League try of series 1, and with the rounds their matches, games and teams, so what the site has made of them since is gone, tries logged there, an admin's try edits, fixes to a round team or an imported try's team, and round games recorded or fixed; series 1's cup, its snapshots and an admin-set hatched count stay. That makes it a full import only. On the local stack or the preview, where nothing the site made needs keeping, a rerun is also how the preview's matches get their games after the league's games migration drops the old replay links. For the preview, run it with the preview's `DATABASE_URL` (the Neon `dev` branch), `S3_*` variables and `LEAGUE_TARGET=preview`; it refuses any other database or store off the local stack, unless `LEAGUE_TARGET` is `production`, its production mode below. Each imported player signs in on the local stack or the preview through the test sign-in, `/api/auth/dev/sign-in?username=<name>` with `vicky`, `dloez`, `javi`, `inop`, `tole` or `elfo`.

For production, the import runs a single time, after `league` has merged into `main` and that deploy has migrated the production branch: it is not run again, since a rerun would wipe the league the site has kept since. Elfo v Javi, unplayed in the dump, is entered on its match page by an admin once the owner says it is played. It makes no account there: it maps the six to their own Discord accounts.

1. Write `pkmn/site/saves/league-users.json` (gitignored) with each app player's Discord user ID, the one an admin invites by (Discord's Copy User ID, with Developer Mode on):

   ```json
   {
     "Vicky": "<Discord user ID>",
     "Dloez": "<Discord user ID>",
     "Javi": "<Discord user ID>",
     "Inop": "<Discord user ID>",
     "Tole": "<Discord user ID>",
     "Elfo": "<Discord user ID>"
   }
   ```

2. From `pkmn/site/`, with the production branch's direct connection string (Neon's `main`, the one without `-pooler`) and `LEAGUE_TARGET=production` set in the shell:

   ```sh
   DATABASE_URL='<production direct connection string>' LEAGUE_TARGET=production npm run league-import
   ```

It prints what the preview's run prints, the import "through the production map". It stops before writing anything, naming the player, when the map leaves one out or no account has their Discord user ID: invite them at `/admin/players` with that ID, or fix the map, and run it again. The import writes no file to the bucket and makes no session, so the `S3_*` variables and `BETTER_AUTH_SECRET`, which the script needs set to start, can stay the local ones from `.env.local`. Then check series 1's league against the app (rounds, results, replays, standings, Pokémon League tries, eggs and every matchday team) before retiring the Trainer League app.

### Inspect deployments and the database from the shell

Neither CLI is installed: run both through `npx` from `pkmn/site/`, where `.vercel/` links the Vercel CLI to the project `dloez/enbraile-pkmn`. Each signs in once per machine, `npx vercel login` and `npx neonctl auth`; `npx vercel whoami` and `npx neonctl me` show the account. The Neon project is `pkmn-site` (ID `wandering-pine-85287086`, in the Vercel organization `org-bitter-block-45974978`), with the branches `main` (production) and `dev` (previews).

| To | Run |
|----|-----|
| List the deployments, newest first, with their environment and state | `npx vercel ls` |
| See which commit and when a deployment was built | `npx vercel inspect <deployment URL>` |
| Read a deployment's build log | `npx vercel inspect <deployment URL> --logs` |
| Read the function's runtime logs | `npx vercel logs --deployment <deployment URL>` |
| List a Vercel environment's variables | `npx vercel env ls --environment preview` (or `production`) |
| Read the project's settings, such as `protectionBypass` | `npx vercel api /v9/projects/enbraile-pkmn` |
| List the Neon projects | `npx neonctl projects list --org-id org-bitter-block-45974978` |
| List the Neon branches | `npx neonctl branches list --project-id wandering-pine-85287086` |
| Print a branch's connection string | `npx neonctl connection-string dev --project-id wandering-pine-85287086 --pooled` (drop `--pooled` for the direct one) |
| Run SQL on a branch | `npx neonctl connection-string dev --project-id wandering-pine-85287086 --psql -- -c "<sql>"` |

`vercel env ls` names the variables and never shows their values, since they are sensitive. A branch's connection string carries its password: keep it out of commits and logs. The number of rows in `drizzle.__drizzle_migrations` is how many migrations a branch has applied, so `select count(*) from drizzle.__drizzle_migrations` on `dev` and on `main` shows how far each one has been migrated. Without `psql` on the `PATH`, `neonctl` runs its own.

### Rebuild a game's item icons

A game's item icon sheet is built when its zip is uploaded ([The pkmn Site → Games](../explanation/site.md#games)). For a zip uploaded before the sheet existed, or to rebuild them all, run from `pkmn/site/` with the environment's `DATABASE_URL` and `S3_*` variables set in the shell (a shell variable wins over `.env.local`):

```sh
npm run item-icons
```

It prints each game's icon count, or that its zip holds no `Graphics/Items`.

### Refresh the Spanish game text

After an `@pkmn/dex` upgrade, or to pick up PokeAPI's newer names, refresh the Spanish game data in `src/i18n/es/` ([The pkmn Site → Languages](../explanation/site.md#languages)). From `pkmn/site/`, with a network connection:

```sh
npm run dex-es -- names                   # rebuilds names.json from PokeAPI's CSVs and names.extra.json
npm run dex-es -- pending pending.json    # writes every description that is new or whose English changed
```

`names` prints, per kind, how many names stay English; add a missing official name to `names.extra.json` and run it again. Translate `pending.json`'s values into Spanish, keeping its shape, IDs and every mechanic, and with the official names from `names.json`, then fold them in, which also records the hash of each English source:

```sh
npm run dex-es -- apply translated.json
```

`apply` drops descriptions the dex no longer has. Run `pending` again to see zero left, then the gate, and commit `src/i18n/es/`.

### Sweep the bucket by hand

The daily sweep ([The pkmn Site → Data and Storage](../explanation/site.md#data-and-storage)) shows its runs under the project's Settings → Cron Jobs in the Vercel dashboard, where Run starts one at once. From a shell, with the production `CRON_SECRET`:

```sh
curl -s -H "Authorization: Bearer $CRON_SECRET" https://pkmn.enbraile.vip/api/cron/sweep-files
```

It prints the keys it deleted and how many objects it kept.

### Wipe the imported data

When the snapshot format changes in a way old snapshots cannot follow, the imported data is wiped and players upload again. From `pkmn/site/`, with the environment's `DATABASE_URL`, `S3_*` variables set in the shell:

```sh
npm run wipe-imports            # prints the database host and bucket it would wipe
npm run wipe-imports -- --yes   # deletes every team, save and snapshot, and every file under saves/
```

It keeps the accounts, the allowlist, the games with their zips and icons, and the series with their players and milestones. For production that is the `main` branch's connection string and the production bucket; for the previews the `dev` branch and `pkmn-site-preview-enbraile`. It cannot be undone, short of Neon's point-in-time restore for the database; the bucket's files are gone.

### 8. Roll back

Use Instant Rollback on the previous production deployment in the Vercel dashboard, or revert the commit and push, which redeploys. A migration is not rolled back: a schema change is undone by a new forward migration, and lost data comes back through Neon's point-in-time restore.

### Refresh the export's data

Only when the game build, the mod's data (`pkmn/games/anil/src/anil/mod/`) or Showdown's item list changes, the owner regenerates the save export's `api/_lib/export/data.json` ([Save Export → Data Shipped With the Export](../explanation/save-export.md#data-shipped-with-the-export)). It reads the mod and the game files in `pkmn/games/anil/game/`, which [How to Install the Game](../../games/anil/how-to/install-the-game.md) fetches, and downloads Showdown's `data/items.ts`, so it needs a network connection. From the repository root:

```sh
uv run pkmn/games/anil/generate_export_data.py
```

It prints its counts and whether it wrote `data.json`, which it rewrites only when it changed. Commit and push it: it reaches the site with the next deploy.

## Verification

- Signed in, `https://pkmn.enbraile.vip` sends the reader to the running series' page, or to `/series` while none runs, and `/teams` lists the teams.
- At `/admin/series`, an admin creates a draft, sees its checklist list what is missing, fills it in until Start enables, and starts it; its players then land on it, read its rules and download its game, and an allowed player outside it sees no Download. `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/admin/series` prints `401`.
- `/admin` signs an admin in with the password `admin:create` set, refuses a wrong one with "Wrong username or password", and signs out.
- `curl -s -o /dev/null -w '%{http_code}' 'https://pkmn.enbraile.vip/api/auth/dev/sign-in?username=x'` prints `404`.
- At `/admin/games`, an admin creates a game, uploads its zip, sees its size and date after a reload, and downloads a file of the same size; `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/games` prints `401`.
- Signed out, `https://pkmn.enbraile.vip` shows the sign-in page. Signing in with Discord as someone new shows the waiting page; an admin allows them at `/admin/players`, and their reload shows the series; removed, their reload shows the waiting page again. Let in and added to the running series at its form, they are asked to upload their save instead, and land on the series once it is in. Invited at `/admin/players` by their Discord user ID before they sign in, someone new lands straight on the series instead, under the name Discord gives them. `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/players` prints `401`.
- `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/cron/sweep-files` prints `401`, and the project's Cron Jobs settings list `/api/cron/sweep-files` daily.
- `curl -sI https://pkmn.enbraile.vip` shows `server: Vercel`.
- After a push, the page loads a new `/assets/index-*.js` bundle carrying the change.
