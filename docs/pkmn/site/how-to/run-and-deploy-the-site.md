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
- `DEV_SIGN_IN`: `1` turns on the dev-only test sign-in ([How to Verify the Site](verify-the-site.md)). Never set it anywhere but a local `.env.local`.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`: the Discord application's OAuth2 client (step 6). Left empty, Discord sign-in is not registered and its button answers "Sign-in failed"; the local stack signs players in with the test sign-in instead.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: the file store; the example's point at the local MinIO and its `pkmn-site` bucket. With a second stack's `MINIO_PORT`, match the port in `S3_ENDPOINT`.

Then apply the migrations and seed the known state:

```sh
npm run db:migrate
npm run seed
```

`seed` makes the admin `admin` with the password `admin-password`, the test players Red and Blue, allowed, and Leaf, waiting for an admin, the game "Pokémon Añil + Randomlocke" with a small stand-in zip put in the bucket, Series 1 running on it, on the daytime route, with Red and Blue as its players, ten milestones and the rules of `docs/pkmn/series/1/reference/rules.md`, and, when `pkmn/site/saves/` (gitignored) holds a save zip, a snapshot for Red from the first one, at the milestone its save suggests or else Post-League, through the same pipeline as an upload, skipping any already there, and refuses a `DATABASE_URL` or `S3_ENDPOINT` whose host is not `localhost` or `127.0.0.1`. To make a real admin instead, `npm run admin:create <name>` asks for the password twice; it refuses a name already taken and a password under 8 characters. Every script reads `.env.local`; a variable already set in the shell wins over it.

After changing `api/_lib/schema.ts`, write the next migration with `npm run db:generate`, check the migrations with `npx drizzle-kit check`, and commit the new files in `drizzle/`. A migration only goes forward: to undo a change, generate another.

### 4. Run it locally

```sh
npm run dev
```

Vite starts the API itself (`scripts/dev-api.ts` under `tsx watch`, on `API_PORT`, restarting on changes), proxies `/api` to it, prints the local URL, and stops the API when it stops. Every page but `/admin` asks a signed-out reader to sign in, and players sign in locally with the test sign-in ([How to Verify the Site](verify-the-site.md)). A signed-in player lands on the running series at `/series/<n>`, every series is at `/series`, Open Sheet is at `/open-sheet`, admins sign in at `/admin`, the allowlist is at `/admin/players`, the games are at `/admin/games` and the series are at `/admin/series`. A series page's Upload button takes a save zip as a snapshot. Imports and teams are stored in that browser's IndexedDB for the dev origin.

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

Neon's connection strings carry `sslmode=require`, which `pg` already treats as `verify-full` and warns about on every connection; write `sslmode=verify-full` in every Neon string, in Vercel and in the shell, which keeps the same certificate checks and silences the warning.

`API_PORT` and `DEV_SIGN_IN` stay unset in Vercel: without `DEV_SIGN_IN` the test sign-in does not exist. Then migrate each branch and make the admins with that branch's direct connection string (the one without `-pooler`) and its environment's `BETTER_AUTH_SECRET` set in the shell, since `admin:create` loads the site's auth setup, which refuses to start without one:

```sh
export DATABASE_URL='<the branch's direct connection string>'
export BETTER_AUTH_SECRET='<that environment's secret>'
npm run db:migrate
npm run admin:create <name>
unset DATABASE_URL BETTER_AUTH_SECRET
```

### 7. Deploy

Migrate production first when the change carries a new migration: run `npm run db:migrate` with the production branch's direct connection string as `DATABASE_URL` in the shell. Then push to `main`. Vercel builds and deploys every push that touches `pkmn/site/` to production, and a branch push gets a public preview URL, shown on the commit's GitHub status and in the Vercel dashboard. There is no manual deploy command.

### 8. Roll back

Use Instant Rollback on the previous production deployment in the Vercel dashboard, or revert the commit and push, which redeploys. A migration is not rolled back: a schema change is undone by a new forward migration, and lost data comes back through Neon's point-in-time restore.

### Refresh the export's data

Only when the game build, the mod's data (`pkmn/games/anil/src/anil/mod/`) or Showdown's item list changes, the owner regenerates the save export's `api/_lib/export/data.json` ([Save Export → Data Shipped With the Export](../explanation/save-export.md#data-shipped-with-the-export)). It reads the mod and the game files in `pkmn/games/anil/game/`, which [How to Install the Game](../../games/anil/how-to/install-the-game.md) fetches, and downloads Showdown's `data/items.ts`, so it needs a network connection. From the repository root:

```sh
uv run pkmn/games/anil/generate_export_data.py
```

It prints its counts and whether it wrote `data.json`, which it rewrites only when it changed. Commit and push it: it reaches the site with the next deploy.

## Verification

- Signed in, `https://pkmn.enbraile.vip` sends the reader to the running series' page, or to `/series` while none runs, and `/open-sheet` serves the tool.
- At `/admin/series`, an admin creates a draft, sees its checklist list what is missing, fills it in until Start enables, and starts it; its players then land on it, read its rules and download its game, and an allowed player outside it sees no Download. `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/admin/series` prints `401`.
- `/admin` signs an admin in with the password `admin:create` set, refuses a wrong one with "Wrong username or password", and signs out.
- `curl -s -o /dev/null -w '%{http_code}' 'https://pkmn.enbraile.vip/api/auth/dev/sign-in?username=x'` prints `404`.
- At `/admin/games`, an admin creates a game, uploads its zip, sees its size and date after a reload, and downloads a file of the same size; `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/games` prints `401`.
- Signed out, `https://pkmn.enbraile.vip` shows the sign-in page. Signing in with Discord as someone new shows the waiting page; an admin allows them at `/admin/players`, and their reload shows the series; removed, their reload shows the waiting page again. `curl -s -o /dev/null -w '%{http_code}' https://pkmn.enbraile.vip/api/players` prints `401`.
- `curl -sI https://pkmn.enbraile.vip` shows `server: Vercel`.
- After a push, the page loads a new `/assets/index-*.js` bundle carrying the change.
